#!/usr/bin/env bash
# 实测各模型的上下文上限。
#
# 原理：不上传大文件，而是让 max_tokens 超限。OpenAI 兼容的推理服务
# （vLLM / SGLang / 各家网关）在收到 prompt_tokens + max_tokens > 上下文
# 的请求时，会在**进入推理之前**拒绝，并在错误里报出真实上限，形如
#   "This model's maximum context length is 262144 tokens. However, you
#    requested 100000002 tokens (2 in the messages, 100000000 in the
#    completion)."
# 所以这些请求既不产生 token 计费，也不占用 GPU。
#
# 用法：
#   ./bin/probe-context-window.sh sk-你的网关key [网关地址]
# 默认打生产网关。只读，不改任何配置。

set -uo pipefail

KEY="${1:?用法: $0 <api-key> [base-url]}"
BASE="${2:-https://gateway.zgci.org}"

CHAT_MODELS=(smart-router glm glm-anthropic qwen minimax gemma4:26b)
EMBED_MODELS=(bge-m3 qwen3-embedding:4b)

# 上限探针：给一个任何部署都不可能满足的 max_tokens
HUGE=100000000

say() { printf '%-22s %s\n' "$1" "$2"; }

echo "== 对话模型 =="
for m in "${CHAT_MODELS[@]}"; do
  # glm-anthropic 只认 Anthropic 协议，走 /v1/messages
  if [ "$m" = "glm-anthropic" ]; then
    resp=$(curl -s -m 60 "$BASE/v1/messages" \
      -H "x-api-key: $KEY" -H 'anthropic-version: 2023-06-01' \
      -H 'Content-Type: application/json' \
      -d "{\"model\":\"$m\",\"max_tokens\":$HUGE,\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}")
  else
    resp=$(curl -s -m 60 "$BASE/v1/chat/completions" \
      -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
      -d "{\"model\":\"$m\",\"max_tokens\":$HUGE,\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}")
  fi
  # 只把错误正文摘出来，成功响应说明这个服务端不校验 max_tokens，要换探法
  msg=$(printf '%s' "$resp" | python3 -c '
import json,sys
try:
    d=json.load(sys.stdin)
except Exception:
    print(sys.stdin.read()[:200] if False else "解析失败"); raise SystemExit
e=d.get("error") or {}
m=e.get("message") if isinstance(e,dict) else str(e)
print(m or ("未报错——该服务端不校验 max_tokens，需要改用长 prompt 二分探测"))
' 2>/dev/null)
  say "$m" "${msg:0:220}"
done

echo
echo "== 向量模型 =="
# 向量模型没有 max_tokens，改用超长 input：同样在编码前就会被拒。
# 请求体在 Python 里直接写进临时文件——40 万字符塞进命令行会超 ARG_MAX。
for m in "${EMBED_MODELS[@]}"; do
  body=$(mktemp)
  python3 -c "
import json,sys
json.dump({'model': sys.argv[1], 'input': '词 ' * 200000}, open(sys.argv[2],'w'))
" "$m" "$body"
  resp=$(curl -s -m 120 "$BASE/v1/embeddings" \
    -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
    --data-binary @"$body")
  rm -f "$body"
  msg=$(printf '%s' "$resp" | python3 -c '
import json,sys
try:
    d=json.load(sys.stdin)
except Exception:
    print("解析失败"); raise SystemExit
e=d.get("error") or {}
m=e.get("message") if isinstance(e,dict) else str(e)
print(m or "未报错——20 万字都没超限，需要加长再试")
' 2>/dev/null)
  say "$m" "${msg:0:220}"
done

echo
echo "说明：上面每条错误里的数字就是该模型的真实上下文上限。"
echo "报 401/404 的说明这个别名当前不可用或密钥无权限，不代表没有上限。"
