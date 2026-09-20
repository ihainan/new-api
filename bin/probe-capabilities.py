#!/usr/bin/env python3
"""探测各模型实际支持哪些能力，结果用于填 web/src/components/portal/modelCatalog.js。

为什么要脚本而不是手填：模型和上游随时会换，手填的能力表很快变成过期的谎话。
这个脚本可以重跑，换模型之后拿它的输出对一遍目录即可。

踩过的坑，改之前先读：

1. **测能力要用 tool_choice="required"，不能用 auto。** auto 测的是「模型这次想不想
   调工具」，不是「它能不能」。实测 smart-router 在 auto 下 5 次里有 1 次不调、
   qwen 有 2 次不调；按 auto 的结果会把两个都误判成不支持函数调用。

2. **max_tokens 要给够。** 会思考的模型先吐 reasoning_content，给 40 的预算会被思考
   吃光、正文为空，看起来像「不支持」。这里一律给 600。

3. **视觉要用两种颜色交叉验证。** 只问一张红图，模型瞎猜「红」也有不低的概率蒙对。
   两种颜色都答对才算真看见。

4. **字段名各家不一样，判据不要写死一个。** glm 的思考在 reasoning_content，
   qwen 在 reasoning；流式增量同理。只认一个名字会把对方误判成「不支持」——
   qwen 的流式和思考都是这么被我错判过一轮的。

5. **不能用「字段存不存在」判断能力。** dto/openai_response.go 里 reasoning_tokens /
   cached_tokens 都没有 omitempty，零值照样会出现在响应里。搜字符串会把
   `cached_tokens: 0` 判成「支持缓存」、`reasoning_content: null` 判成「会思考」。
   必须看值：缓存要用同一段长前缀连发两次、第二次命中数大于 0 才算；思考要
   reasoning_content 非空或 reasoning_tokens 大于 0。

6. **探测失败 ≠ 不支持。** 网络不通、上游 500 都会让一项测不出来，必须和实测的
   「不支持」分开记，否则会把自己的环境问题写成模型的缺陷。本脚本用 None 表示
   没测出来，目录里对应「键缺失」，页面显示「未测」。

7. **能力是「正向证据」：成功一次就成立，失败一次什么也证明不了。** 模型有随机性，
   同一个探测反复跑结果会变——实测 qwen 和 minimax 打的是同一个上游模型，单次探测
   却一个 ✓ 一个 ✗。所以每项失败后要重试，连续失败若干次才敢记 ✗。

8. **Anthropic 入口要单独测，不能拿 OpenAI 那轮的结果顶。** 同一个模型挂两个协议
   入口，支持的参数并不一样：Anthropic 协议没有 response_format（JSON 模式属于
   「协议不提供」而不是「模型不支持」），思考要显式传 thinking，缓存要在内容块上
   打 cache_control。判据也不同——工具调用看 content 里有没有 tool_use 块。

9. **smart-router 是路由，不是模型。** 它背后是 glm 和 qwen，两者能力不同
   （glm 看不见图、qwen 能看见），所以带图和不带图的请求可能落到不同后端。
   对它要分别测两轮，结论取「两轮都成立」的那部分——调用方无法指定后端，
   只有始终成立的能力才敢承诺。

用法：
    python3 bin/probe-capabilities.py [网关地址] [api-key]
默认打本地开发网关。每项探测都是小请求，但会产生真实调用。
"""

import base64
import io
import json
import sys
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3000").rstrip("/")
KEY = sys.argv[2] if len(sys.argv) > 2 else ""
URL = BASE + "/v1/chat/completions"
BUDGET = 600  # 见上面第 2 条

# minimax 待下线，不再探测（它打的就是 qwen 那个上游）
CHAT_MODELS = ["smart-router", "glm", "qwen", "gemma4:26b"]
# 走 Anthropic Messages 协议的，用另一套请求和判据，见第 8 条
ANTHROPIC_MODELS = ["glm-anthropic"]
ROUTERS = {"smart-router"}  # 见第 9 条，要跑两轮

TOOLS = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "查询某城市的天气",
        "parameters": {
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
    },
}]

LABELS = {
    "stream": "流式输出", "tools": "函数调用", "json": "JSON 模式",
    "vision": "图像输入", "reasoning": "深度思考", "cache": "提示缓存",
}


def solid_png(rgb):
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), rgb).save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


RED = solid_png((220, 30, 30))
BLUE = solid_png((30, 60, 220))


def post(payload, timeout=180):
    req = urllib.request.Request(
        URL,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + KEY},
        method="POST",
    )
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:
        return 0, "%s: %s" % (type(e).__name__, e)


def attempt(fn, tries=3):
    """能力是正向证据：成功一次即成立。失败要重试，连续失败才记 False。
    返回 None 表示每次都是调用层面的失败（连不上 / 5xx），那是没测出来。"""
    saw_call_failure = False
    for _ in range(tries):
        ok = fn()
        if ok is True:
            return True
        if ok is None:
            saw_call_failure = True
    return None if saw_call_failure else False


def message(body):
    try:
        return json.loads(body)["choices"][0]["message"]
    except Exception:
        return {}


def with_image(text, img):
    return [{"type": "text", "text": text},
            {"type": "image_url", "image_url": {"url": img}}]


def probe(model, multimodal=False):
    """multimodal=True 时每个请求都带一张图，用来把路由逼到能看图的后端。"""
    caps = {}

    def msgs(text):
        return [{"role": "user", "content": with_image(text, RED) if multimodal else text}]

    # 流式：逐个数 SSE 事件，要求真有增量内容。整段读完再 grep "data:"
    # 连「服务端缓冲完一次性返回」和「只有一个 [DONE]」都分不出来。
    code, body = post({"model": model, "max_tokens": 32, "stream": True,
                       "messages": msgs("数到五")})
    if code != 200:
        caps["stream"] = None
    else:
        deltas = 0
        for line in body.splitlines():
            if not line.startswith("data:"):
                continue
            chunk = line[5:].strip()
            if not chunk or chunk == "[DONE]":
                continue
            try:
                d = json.loads(chunk)["choices"][0].get("delta") or {}
            except Exception:
                continue
            # 各家的增量字段名不统一：content / reasoning_content / reasoning
            # 都见过。只认 content 会把 qwen 误判成不支持流式——它 32 token
            # 的预算全花在 delta.reasoning 上，正文一个字都没来得及出。
            if any(isinstance(d.get(k), str) and d[k] for k in
                   ("content", "reasoning_content", "reasoning")):
                deltas += 1
        caps["stream"] = deltas >= 2

    # 函数调用：required 强制，见第 1 条；失败重试，见第 7 条
    def _tools():
        code, body = post({"model": model, "max_tokens": BUDGET, "tools": TOOLS,
                           "tool_choice": "required", "messages": msgs("北京现在天气怎么样")})
        if code != 200:
            return None
        return bool(message(body).get("tool_calls"))
    caps["tools"] = attempt(_tools)

    # JSON 模式：返回的正文必须原样就能解析，光 200 不算
    def _json():
        code, body = post({"model": model, "max_tokens": BUDGET,
                           "response_format": {"type": "json_object"},
                           "messages": msgs("只输出 JSON 对象，键 ok 值 1")})
        if code != 200:
            return None
        # 不剥 markdown 围栏：剥了等于替模型把活干了，那证明不了
        # response_format 真的生效。原始正文必须直接能解析。
        try:
            json.loads((message(body).get("content") or "").strip())
            return True
        except Exception:
            return False
    caps["json"] = attempt(_json)

    # 视觉：两种颜色都答对才算，见第 3 条；同样失败重试
    def _vision():
        for img, words in [(RED, ("红", "red")), (BLUE, ("蓝", "blue"))]:
            code, body = post({"model": model, "max_tokens": BUDGET,
                               "messages": [{"role": "user",
                                             "content": with_image("这张图是什么颜色？只回答颜色", img)}]})
            # 只认 200。5xx / 404 是上游或网络的问题，不是模型没有这个能力——
            # 之前只判 code==0，把 gemma4 的 500 记成了「实测不支持」。
            if code != 200:
                return None
            txt = (message(body).get("content") or "").lower()
            if not any(w in txt for w in words):
                return False
        return True
    caps["vision"] = attempt(_vision, tries=2)

    # 思考链：要看到真的思考内容，不能只看字段在不在（见第 5 条）。
    # 题目要挑一个值得思考的，用「1+1」问一次没出思考就判不支持是不成立的。
    def _reasoning():
        code, body = post({"model": model, "max_tokens": BUDGET,
                           "messages": msgs("一个笼子里有鸡和兔共 35 个头、94 只脚，各几只？请推理")})
        if code != 200:
            return None
        m = message(body)
        # 字段名同样不统一：glm 用 reasoning_content，qwen 用 reasoning。
        # 只查前者会把 qwen 误判成不会思考。
        rc = next((m[k] for k in ("reasoning_content", "reasoning")
                   if isinstance(m.get(k), str) and m[k].strip()), None)
        try:
            rt = json.loads(body)["usage"]["completion_tokens_details"]["reasoning_tokens"]
        except Exception:
            rt = 0
        return bool(rc or (rt or 0) > 0)
    caps["reasoning"] = attempt(_reasoning)

    # 提示缓存：同一段长前缀连发两次，第二次的命中数必须大于 0。
    # 光看 cached_tokens 字段在不在会把 0 判成「支持」。
    prefix = "以下是一段用于缓存测试的固定前缀。" * 400
    hit = None
    for i in range(2):
        code, body = post({"model": model, "max_tokens": 16,
                           "messages": [{"role": "user", "content": prefix + "回答：好"}]})
        if code != 200:
            hit = None
            break
        try:
            hit = json.loads(body)["usage"]["prompt_tokens_details"]["cached_tokens"]
        except Exception:
            hit = 0
    caps["cache"] = None if hit is None else hit > 0
    return caps


ANTHROPIC_TOOLS = [{
    "name": "get_weather",
    "description": "查询某城市的天气",
    "input_schema": {
        "type": "object",
        "properties": {"city": {"type": "string"}},
        "required": ["city"],
    },
}]


def post_anthropic(payload, timeout=180):
    req = urllib.request.Request(
        BASE + "/v1/messages",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "x-api-key": KEY,
                 "anthropic-version": "2023-06-01"},
        method="POST",
    )
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:
        return 0, "%s: %s" % (type(e).__name__, e)


def blocks(body):
    try:
        return json.loads(body).get("content") or []
    except Exception:
        return []


def probe_anthropic(model):
    """按 Anthropic Messages 协议探测。判据和 OpenAI 那套不通用。"""
    caps = {}
    base_msg = [{"role": "user", "content": "北京现在天气怎么样"}]

    # 流式：Anthropic 的增量是 content_block_delta 事件
    code, body = post_anthropic({"model": model, "max_tokens": 64, "stream": True,
                                 "messages": [{"role": "user", "content": "数到五"}]})
    if code != 200:
        caps["stream"] = None
    else:
        caps["stream"] = body.count("content_block_delta") >= 2

    # 工具调用：content 里要出现 tool_use 块；tool_choice 用 any 强制
    def _tools():
        code, body = post_anthropic({
            "model": model, "max_tokens": BUDGET, "tools": ANTHROPIC_TOOLS,
            "tool_choice": {"type": "any"}, "messages": base_msg})
        if code != 200:
            return None
        return any(b.get("type") == "tool_use" for b in blocks(body))
    caps["tools"] = attempt(_tools)

    # JSON 模式：Anthropic 协议根本没有 response_format 这个参数。
    # 这是「协议不提供」，不是「模型不支持」，所以单列一个状态。
    caps["json"] = "na"

    # 视觉：Anthropic 用 image 内容块 + base64 source
    def _vision():
        for img, words in [(RED, ("红", "red")), (BLUE, ("蓝", "blue"))]:
            data = img.split(",", 1)[1]
            code, body = post_anthropic({
                "model": model, "max_tokens": BUDGET,
                "messages": [{"role": "user", "content": [
                    {"type": "image", "source": {"type": "base64",
                                                 "media_type": "image/png", "data": data}},
                    {"type": "text", "text": "这张图是什么颜色？只回答颜色"},
                ]}]})
            if code != 200:
                return None
            txt = " ".join(b.get("text", "") for b in blocks(body)).lower()
            if not any(w in txt for w in words):
                return False
        return True
    caps["vision"] = attempt(_vision, tries=2)

    # 思考：Anthropic 要显式开 thinking，响应里出现 thinking 块才算
    def _reasoning():
        code, body = post_anthropic({
            "model": model, "max_tokens": 2048,
            "thinking": {"type": "enabled", "budget_tokens": 1024},
            "messages": [{"role": "user",
                          "content": "一个笼子里有鸡和兔共 35 个头、94 只脚，各几只？"}]})
        if code != 200:
            return None
        return any(b.get("type") in ("thinking", "redacted_thinking") for b in blocks(body))
    caps["reasoning"] = attempt(_reasoning)

    # 缓存：在长内容块上打 cache_control，连发两次，看 cache_read_input_tokens
    prefix = "以下是一段用于缓存测试的固定前缀。" * 400
    hit = None
    for _ in range(2):
        code, body = post_anthropic({
            "model": model, "max_tokens": 16,
            "messages": [{"role": "user", "content": [
                {"type": "text", "text": prefix,
                 "cache_control": {"type": "ephemeral"}},
                {"type": "text", "text": "回答：好"},
            ]}]})
        if code != 200:
            hit = None
            break
        try:
            hit = json.loads(body)["usage"].get("cache_read_input_tokens", 0)
        except Exception:
            hit = 0
    caps["cache"] = None if hit is None else hit > 0
    return caps


def merge(a, b):
    """路由模型取两轮的交集：任一轮不成立就不敢承诺；任一轮没测出来就记未测。"""
    out = {}
    for k in LABELS:
        x, y = a.get(k), b.get(k)
        if x is None or y is None:
            out[k] = None
        else:
            out[k] = bool(x and y)
    return out


def cell(v):
    if v is True:
        return "✓"
    if v is False:
        return "✗"
    if v == "na":
        return "—"   # 协议不提供这个参数，不是模型不支持
    return "?"


if __name__ == "__main__":
    print("%-16s %s" % ("模型", "  ".join("%-5s" % v for v in LABELS.values())))
    print("-" * 74)
    for m in CHAT_MODELS:
        if m in ROUTERS:
            plain = probe(m, multimodal=False)
            multi = probe(m, multimodal=True)
            for tag, c in (("（纯文本请求）", plain), ("（带图请求）", multi), ("（两轮取交集）", merge(plain, multi))):
                print("%-16s %s" % (m + tag, "  ".join("%-6s" % cell(c[k]) for k in LABELS)))
        else:
            c = probe(m)
            print("%-16s %s" % (m, "  ".join("%-6s" % cell(c[k]) for k in LABELS)))
    for m in ANTHROPIC_MODELS:
        c = probe_anthropic(m)
        print("%-16s %s" % (m + "（Anthropic）", "  ".join("%-6s" % cell(c[k]) for k in LABELS)))
    print("\n✓＝实测支持   ✗＝实测不支持   —＝该协议不提供   ?＝没测出来（不等于不支持）")
