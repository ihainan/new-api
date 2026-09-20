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

4. **探测失败 ≠ 不支持。** 网络不通、上游 500 都会让一项测不出来，必须和实测的
   「不支持」分开记，否则会把自己的环境问题写成模型的缺陷。本脚本用 None 表示
   没测出来，目录里对应「键缺失」，页面显示「未测」。

5. **smart-router 是路由，不是模型。** 它背后是 glm 和 qwen，两者能力不同
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

CHAT_MODELS = ["smart-router", "glm", "glm-anthropic", "qwen", "minimax", "gemma4:26b"]
ROUTERS = {"smart-router"}  # 见第 5 条，要跑两轮

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
    "stream": "流式输出", "tools": "函数调用", "json": "结构化输出",
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

    # 流式：拿到 SSE 分片就算支持；连不上记 None
    code, body = post({"model": model, "max_tokens": 8, "stream": True,
                       "messages": msgs("hi")})
    caps["stream"] = True if (code == 200 and "data:" in body) else (None if code != 200 else False)

    # 函数调用：required 强制，见第 1 条
    code, body = post({"model": model, "max_tokens": BUDGET, "tools": TOOLS,
                       "tool_choice": "required", "messages": msgs("北京现在天气怎么样")})
    caps["tools"] = bool(message(body).get("tool_calls")) if code == 200 else None

    # 结构化输出：返回的正文必须真能解析成 JSON，光 200 不算
    code, body = post({"model": model, "max_tokens": BUDGET,
                       "response_format": {"type": "json_object"},
                       "messages": msgs("只输出 JSON 对象，键 ok 值 1")})
    if code != 200:
        caps["json"] = None
    else:
        txt = (message(body).get("content") or "").strip().strip("`")
        if txt.startswith("json"):
            txt = txt[4:]
        try:
            json.loads(txt)
            caps["json"] = True
        except Exception:
            caps["json"] = False

    # 视觉：两种颜色都答对才算，见第 3 条
    vision, failed = True, False
    for img, words in [(RED, ("红", "red")), (BLUE, ("蓝", "blue"))]:
        code, body = post({"model": model, "max_tokens": BUDGET,
                           "messages": [{"role": "user",
                                         "content": with_image("这张图是什么颜色？只回答颜色", img)}]})
        # 只认 200。5xx / 404 是上游或网络的问题，不是模型没有这个能力——
        # 之前只判 code==0，把 gemma4 的 500 记成了「实测不支持」。
        if code != 200:
            failed = True
            break
        txt = (message(body).get("content") or "").lower()
        if not any(w in txt for w in words):
            vision = False
            break
    caps["vision"] = None if failed else vision

    # 思考链与提示缓存：看响应里有没有对应字段
    code, body = post({"model": model, "max_tokens": BUDGET, "messages": msgs("1+1 等于几")})
    if code != 200:
        caps["reasoning"] = caps["cache"] = None
    else:
        caps["reasoning"] = "reasoning_content" in body or "reasoning_tokens" in body
        caps["cache"] = "cached_tokens" in body
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
    return "✓" if v is True else ("✗" if v is False else "?")


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
    print("\n✓＝实测支持   ✗＝实测不支持   ?＝没测出来（网络或上游报错，不等于不支持）")
