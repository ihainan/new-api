#!/usr/bin/env python3
"""直接向上游推理服务探测上下文上限，不经过网关中转。

为什么不走网关：网关只是把请求转发过去，上下文上限是**上游部署**的属性。
直连还能绕开中转层自身的问题，拿到的错误也是上游的原话。

探法：prompt 只有两个字，但 max_tokens 给一个任何部署都满足不了的数。
OpenAI 兼容的推理服务会在进入推理之前拒绝，并在错误里报出真实上限：
  "This model's maximum context length is 262144 tokens. However, you
   requested 100000002 tokens (2 in the messages, 100000000 in the completion)."
所以这些请求不产生 token 计费，也不占 GPU。

渠道地址和密钥从本地开发库读，密钥不会出现在输出里。
"""

import json
import re
import sqlite3
import sys
import urllib.error
import urllib.request

DB = sys.argv[1] if len(sys.argv) > 1 else "dev-data/dev.db"
HUGE = 100_000_000
TIMEOUT = 60

# (渠道 id, 网关上的别名) —— 上游真实模型名从该渠道的 model_mapping 里取，
# 没有映射就说明上游直接认这个别名。
TARGETS = [
    (6, "smart-router"),
    (5, "glm"),
    (10, "glm-anthropic"),
    (13, "qwen"),
    (13, "minimax"),
    (7, "gemma4:26b"),
    (7, "bge-m3"),
    (7, "qwen3-embedding:4b"),
    (7, "bge-reranker-v2-m3"),
]

# 错误正文里报出来的上限，各家措辞不同，多抓几种写法
LIMIT_PATTERNS = [
    r"maximum context length is (\d+)",
    r"max_model_len[^\d]{0,20}(\d+)",
    r"context length[^\d]{0,20}(\d+)",
    r"maximum.{0,30}?(\d{4,})\s*tokens",
    r"最大上下文[^\d]{0,10}(\d+)",
]


def post(url, payload, headers):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:
        return 0, f"{type(e).__name__}: {e}"


def extract(body):
    for p in LIMIT_PATTERNS:
        m = re.search(p, body, re.I)
        if m:
            return m.group(1)
    return None


def main():
    db = sqlite3.connect(DB)
    rows = {
        r[0]: r
        for r in db.execute(
            'select id, name, type, base_url, "key", model_mapping from channels'
        )
    }

    for cid, alias in TARGETS:
        if cid not in rows:
            print(f"{alias:<22} 渠道 {cid} 不存在")
            continue
        _, cname, ctype, base, key, mapping = rows[cid]
        upstream = alias
        if mapping:
            try:
                upstream = json.loads(mapping).get(alias, alias)
            except Exception:
                pass

        base = (base or "").rstrip("/")
        if alias == "glm-anthropic":
            url = base + "/v1/messages"
            headers = {"x-api-key": key, "anthropic-version": "2023-06-01"}
            payload = {
                "model": upstream,
                "max_tokens": HUGE,
                "messages": [{"role": "user", "content": "hi"}],
            }
        else:
            # type 8 的 base_url 已经是完整的 chat/completions 地址
            url = base if base.endswith("/chat/completions") else base + "/v1/chat/completions"
            headers = {"Authorization": "Bearer " + key}
            payload = {
                "model": upstream,
                "max_tokens": HUGE,
                "messages": [{"role": "user", "content": "hi"}],
            }

        status, body = post(url, payload, headers)
        limit = extract(body)

        # 有些上游先校验 max_tokens 的取值范围，根本轮不到算上下文
        # （报 "max_tokens must be in [1, N]"）。那就反过来探：max_tokens 给 1，
        # 把 prompt 堆到肯定超限，让它报上下文。同样在推理前被拒，不计费。
        if not limit and re.search(r"max_tokens.{0,40}must be in", body, re.I):
            big = payload.copy()
            big["max_tokens"] = 1
            big["messages"] = [{"role": "user", "content": "的" * 400000}]
            status, body = post(url, big, headers)
            limit = extract(body)
        short = " ".join(body.split())[:170]
        if limit:
            n = int(limit)
            human = f"{n // 1024}K" if n % 1024 == 0 else f"{n:,}"
            print(f"{alias:<22} 上限 {n} ({human})   上游={upstream}")
        else:
            print(f"{alias:<22} [{status}] {short}")


if __name__ == "__main__":
    main()
