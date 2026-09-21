/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

/*
 * 「这个模型怎么调」的唯一数据源。代码块全部由这里生成，不手写——
 * 十一个模型手写十一份，base URL、鉴权头、密钥写法迟早各飘各的。
 *
 * 模型按「调用形状」分类，一共八种。这正是文档必须挂在每个模型旁边、
 * 而不能像 Coding Plan 那样在密钥页写一段的原因：我们这边一个平台里
 * 同时有对话、Anthropic 协议、出图、异步视频、向量、重排、语音转文字、
 * 文字转语音，路径、请求体和返回全不一样。
 *
 * 代码行宽也有硬约束：抽屉里一行大约放得下 66 个等宽字符，生成出来的代码
 * 必须自己守住（示例里的 BASE 是个 Python 变量，不能让占位符把完整 URL
 * 插进 f-string，那样生产域名一长就又超了）。窄屏另外折行。
 * 指望横向滚动条兜底是不行的：Mac 上的悬浮滚动条平时根本不显示。
 *
 * 每一段示例都在本机对着网关真跑过并拿到 200（2026-09-21），验收脚本
 * verify_docs.py 每次从**页面渲染出来的**代码块里抄出 curl 再执行一遍——
 * 文档里的代码跑不通就判失败。只有视频那条不真发（一条要花钱），只核参数形状。
 *
 * 实跑时顺带确认的几件事：cosy-voice 返回 wav（24kHz 单声道）、
 * qwen3-embedding 传 dimensions 确实能裁到 512/1024、bge-m3 是 1024 维、
 * 重排对相关文档给 0.93、不相关给 0.000016。
 */

// 示例里不出现真实密钥：密钥页刻意只显示前几位、不给复制，
// 文档这边再把明文打出来就等于绕过那条规矩。统一用环境变量。
export const KEY_ENV = 'ZGCAI_API_KEY';

const SHAPES = {
  chat: {
    method: 'POST',
    path: '/v1/chat/completions',
    body: (id) => ({
      model: id,
      messages: [{ role: 'user', content: '用一句话解释什么是向量数据库' }],
    }),
    py: (id) => `from openai import OpenAI

client = OpenAI(
    base_url="%BASE%/v1",
    api_key=os.environ["${KEY_ENV}"],
)

resp = client.chat.completions.create(
    model="${id}",
    messages=[
        {"role": "user", "content": "什么是向量数据库？一句话说明"},
    ],
)
print(resp.choices[0].message.content)`,
    pyHead: 'import os\n\n',
  },

  anthropic: {
    method: 'POST',
    path: '/v1/messages',
    headers: { 'anthropic-version': '2023-06-01' },
    body: (id) => ({
      model: id,
      max_tokens: 1024,
      messages: [{ role: 'user', content: '用一句话解释什么是向量数据库' }],
    }),
    py: (id) => `from anthropic import Anthropic

client = Anthropic(
    base_url="%BASE%",
    api_key=os.environ["${KEY_ENV}"],
)

msg = client.messages.create(
    model="${id}",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "什么是向量数据库？一句话说明"},
    ],
)
# 默认开着思考：第一个内容块是 thinking，正文在 type 为 text 的块里
parts = [b.text for b in msg.content if b.type == "text"]
print("".join(parts))`,
    pyHead: 'import os\n\n',
  },

  image: {
    method: 'POST',
    path: '/v1/images/generations',
    body: (id) => ({
      model: id,
      prompt: '雨后的校园林荫道，清晨的光',
      size: '1024x1024',
    }),
    py: (id) => `from openai import OpenAI

client = OpenAI(
    base_url="%BASE%/v1",
    api_key=os.environ["${KEY_ENV}"],
)

img = client.images.generate(
    model="${id}",
    prompt="雨后的校园林荫道，清晨的光",
    size="1024x1024",
)
# 返回的是 base64，不是图片链接
png = base64.b64decode(img.data[0].b64_json)
open("out.png", "wb").write(png)`,
    pyHead: 'import base64, os\n\n',
  },

  // 异步：提交拿任务 ID，再轮询。没有同步版本，别按同步请求设超时。
  video: {
    method: 'POST',
    path: '/v1/videos',
    body: (id) => ({
      model: id,
      prompt: '清晨的院子里下着小雨，一只橘猫蹲在屋檐下',
      seconds: '4',
    }),
    extraCurl: () => `# 2) 轮询任务状态（status 变成 completed 后取视频）
curl %BASE%/v1/videos/task_xxxxxxxx \\
  -H "Authorization: Bearer \${${KEY_ENV}}"`,
    py: (id) => `import os, time, requests

BASE = "%BASE%"
KEY = os.environ["${KEY_ENV}"]
HEAD = {"Authorization": f"Bearer {KEY}"}

# 1) 提交
task = requests.post(
    f"{BASE}/v1/videos",
    headers=HEAD,
    json={
        "model": "${id}",
        "prompt": "清晨的院子里下着小雨，一只橘猫蹲在屋檐下",
        "seconds": "4",
    },
).json()
tid = task["task_id"]

# 2) 轮询：生成以分钟计，别按同步请求写超时
while True:
    r = requests.get(f"{BASE}/v1/videos/{tid}", headers=HEAD)
    st = r.json()
    if st["status"] in ("completed", "failed"):
        break
    time.sleep(10)

# 3) 取视频内容（登录态或密钥都能取）
url = f"{BASE}/v1/videos/{tid}/content"
video = requests.get(url, headers=HEAD).content
open("out.mp4", "wb").write(video)`,
  },

  embedding: {
    method: 'POST',
    path: '/v1/embeddings',
    body: (id) => ({ model: id, input: ['需要转成向量的文本'] }),
    py: (id) => `from openai import OpenAI

client = OpenAI(
    base_url="%BASE%/v1",
    api_key=os.environ["${KEY_ENV}"],
)

out = client.embeddings.create(
    model="${id}",
    input=["需要转成向量的文本"],
)
print(len(out.data[0].embedding))`,
    pyHead: 'import os\n\n',
  },

  // OpenAI 没有这个接口，SDK 里也没有对应方法，只能自己发请求
  rerank: {
    method: 'POST',
    path: '/v1/rerank',
    body: (id) => ({
      model: id,
      query: '苹果的营养价值',
      documents: ['苹果富含维生素与膳食纤维', '北京今天有雨'],
      top_n: 2,
    }),
    py: (id) => `import os, requests

KEY = os.environ["${KEY_ENV}"]

r = requests.post(
    "%BASE%/v1/rerank",
    headers={"Authorization": f"Bearer {KEY}"},
    json={
        "model": "${id}",
        "query": "苹果的营养价值",
        "documents": [
            "苹果富含维生素与膳食纤维",
            "北京今天有雨",
        ],
        "top_n": 2,
    },
)
for hit in r.json()["results"]:
    print(hit["index"], hit["relevance_score"])`,
  },

  asr: {
    method: 'POST',
    path: '/v1/audio/transcriptions',
    form: (id) => [['file', '@meeting.wav'], ['model', id]],
    py: (id) => `from openai import OpenAI

client = OpenAI(
    base_url="%BASE%/v1",
    api_key=os.environ["${KEY_ENV}"],
)

with open("meeting.wav", "rb") as f:
    out = client.audio.transcriptions.create(
        model="${id}",
        file=f,
    )
print(out.text)`,
    pyHead: 'import os\n\n',
  },

  // 不传 voice：OpenAI 那套 alloy/echo 在这里不存在，填了直接 400。
  // 而 OpenAI SDK 的 audio.speech.create 要求必填 voice，所以这里用 requests。
  tts: {
    method: 'POST',
    path: '/v1/audio/speech',
    body: (id) => ({
      model: id,
      input: '今天下午三点开会，地点在二楼会议室。',
      response_format: 'wav',
    }),
    py: (id) => `import os, requests

KEY = os.environ["${KEY_ENV}"]

r = requests.post(
    "%BASE%/v1/audio/speech",
    headers={"Authorization": f"Bearer {KEY}"},
    json={
        "model": "${id}",
        "input": "今天下午三点开会，地点在二楼会议室。",
        "response_format": "wav",
    },
)
# 返回的是 wav（24kHz 单声道）
open("say.wav", "wb").write(r.content)`,
  },
};

/*
 * 模型 → 形状 + 这个模型独有的、不写会踩坑的提醒。
 * 规格类的话（上下文多长、多少参数）不在这里重复，卡片上已经有了。
 */
export const CALL_SPEC = {
  'smart-router': {
    shape: 'chat',
    notes: [
      '实际跑在哪个后端由路由决定，返回里的 `model` 仍是 `smart-router`；想知道当时选了谁，看「使用记录」里那一行。',
      '思考内容可能在 `reasoning_content` 或 `reasoning` 字段里，取决于路由到了哪个后端。',
    ],
  },
  glm: {
    shape: 'chat',
    notes: [
      '本部署不支持图片输入：带图片的请求不报错，但模型看不到图片。',
      '思考内容在 `reasoning_content` 字段里。',
    ],
  },
  'glm-anthropic': {
    shape: 'anthropic',
    notes: [
      '和 `glm` 是同一个模型，只是换成 Anthropic Messages 协议；`max_tokens` 是必填项。',
      '鉴权头用 `Authorization: Bearer`，不是 Anthropic 官方的 `x-api-key`。',
      '默认开着思考，`content` 里第一个块是 `thinking`，正文在 `type` 为 `text` 的块里；直接取 `content[0].text` 会拿到空的。',
    ],
  },
  qwen: {
    shape: 'chat',
    notes: ['思考内容在 `reasoning` 字段里，不是常见的 `reasoning_content`。'],
  },
  'gemma4:26b': { shape: 'chat', notes: [] },
  minimax: { shape: 'chat', notes: [] },
  'qwen-image': {
    shape: 'image',
    notes: [
      '返回的是 base64（`data[0].b64_json`），不是图片链接，需要自己解码保存。',
      '只有 `size` 能调；`seed`、`steps` 这类参数网关不转发，传了也不生效。',
    ],
  },
  'minimax-h3': {
    shape: 'video',
    notes: [
      '异步接口：提交后拿任务 ID，再轮询。生成以分钟计，实测 10 秒的视频跑了 12 分钟。',
      '进度和结果也可以在「任务队列」页看。',
    ],
  },
  'bge-m3': {
    shape: 'embedding',
    notes: [
      '本部署每条输入只处理前 2,048 token，超出的部分既不进模型也不报错，长文档要自己切。',
    ],
  },
  'qwen3-embedding:4b': {
    shape: 'embedding',
    notes: [
      '默认 2,560 维，可以传 `dimensions` 裁剪到更小的维度。',
      '每条输入上限 4,096 token，超出同样是静默截断。',
    ],
  },
  'bge-reranker-v2-m3': {
    shape: 'rerank',
    notes: [
      '这不是 OpenAI 的标准接口，官方 SDK 里没有对应方法，直接发 HTTP 请求。',
      '单条「查询 + 文档」超过 8,192 token 会直接报错，不是截断。',
    ],
  },
  'qwen-asr': {
    shape: 'asr',
    notes: [
      '用 multipart 上传文件，不是 JSON。',
      '超过 145 秒的音频平台会自动切段后拼接，不需要自己处理。',
    ],
  },
  'cosy-voice': {
    shape: 'tts',
    notes: [
      '不传 `voice` 就用默认音色；OpenAI 的 alloy、echo 这些音色在这里不存在，填了会返回 400。',
      '返回的是 wav（24kHz 单声道），不是 mp3。',
      // 实测：往 ref_audio 和 prompt_audio_base64 里各塞一段乱码都返回 200，
      // 说明两个字段都没被用上——网关只转发前者，后端只认后者。
      '音色克隆目前走网关用不了：参考音频传不到后端，传了也会静默地用默认音色。',
    ],
  },
};

const json = (o) => JSON.stringify(o, null, 2);

// cURL：一行一个参数，复制粘贴就能跑
export function curlSnippet(id, base) {
  const spec = CALL_SPEC[id];
  const sh = SHAPES[spec?.shape];
  if (!sh) return '';
  const auth = `  -H "Authorization: Bearer \${${KEY_ENV}}" \\`;
  const lines = [`curl ${base}${sh.path} \\`, auth];
  Object.entries(sh.headers || {}).forEach(([k, v]) =>
    lines.push(`  -H "${k}: ${v}" \\`),
  );
  if (sh.form) {
    sh.form(id).forEach(([k, v]) => lines.push(`  -F "${k}=${v}" \\`));
    lines[lines.length - 1] = lines[lines.length - 1].replace(/ \\$/, '');
  } else {
    lines.push('  -H "Content-Type: application/json" \\');
    lines.push(`  -d '${json(sh.body(id))}'`);
  }
  let out = lines.join('\n');
  if (sh.extraCurl) out = `# 1) 提交任务\n${out}\n\n${sh.extraCurl()}`;
  return out.split('%BASE%').join(base);
}

export function pythonSnippet(id, base) {
  const spec = CALL_SPEC[id];
  const sh = SHAPES[spec?.shape];
  if (!sh) return '';
  return ((sh.pyHead || '') + sh.py(id)).split('%BASE%').join(base);
}

/*
 * 参数表：[参数名, 类型, 是否必填, 说明]。说明里的 `x` 是行内代码，**x** 是加粗。
 *
 * 每一行都在本部署上实测过（2026-09-21，脚本 probe_params / probe_chat / probe_more），
 * 不从 OpenAI、Anthropic 的规范里照抄——照抄的话会出现「文档说能用、实际被网关丢掉」：
 *   - 出图的 seed/steps/cfg：网关转发时不带额外字段（dto/openai_image.go），到不了后端；
 *   - 关思考的开关 glm 和 qwen 各认各的，写反了静默无效，reasoning_effort 两个都不认；
 *   - glm 的 temperature 只接受 0～1，qwen 可以超过 1；
 *   - encoding_format 被忽略，dimensions 超过原生维数不报错。
 * 例外是视频：提交一条要真金白银，所以没有逐个实测，依据的是网关的转发逻辑
 * （sora 适配器整包转发 JSON）和视频后端 bridge 的接口文档，界面上会注明。
 */
const ROWS = {
  "model": ["model", "string", true, "模型 ID。"],
  "messages": ["messages", "array", true, "对话消息，如 `[{\"role\": \"user\", \"content\": \"…\"}]`。"],
  "max_tokens": ["max_tokens", "integer", false, "单次最多输出多少 token。**包含思考过程**：开着思考时设得太小，会在给出答案之前就截断（`finish_reason` 为 `length`）。"],
  "temp_01": ["temperature", "number", false, "随机性，越大越发散。**只接受 0～1**，超出直接返回 400。"],
  "temp_open": ["temperature", "number", false, "随机性，越大越发散，可以超过 1。"],
  "temp_router": ["temperature", "number", false, "随机性，越大越发散。**按 0～1 写**：请求可能被路由到 glm，而 glm 超过 1 会返回 400。"],
  "stream": ["stream", "boolean", false, "为 `true` 时以 SSE 流式返回。"],
  "stop": ["stop", "string / array", false, "生成到停止词就结束。**开着思考时，停止词可能先在思考过程里命中，正文会是空的**；用 stop 时建议关掉思考。"],
  "response_format": ["response_format", "object", false, "传 `{\"type\": \"json_object\"}` 时正文是合法 JSON；提示词里仍要写明需要 JSON。"],
  "tools": ["tools", "array", false, "OpenAI 格式的工具定义；模型决定调用时返回 `tool_calls`。"],
  "think_glm": ["thinking", "object", false, "传 `{\"type\": \"disabled\"}` 关闭思考，默认开着。`reasoning_effort` 不生效。"],
  "think_qwen": ["chat_template_kwargs", "object", false, "传 `{\"enable_thinking\": false}` 关闭思考，默认开着。`reasoning_effort` 不生效。"],
  "think_router": ["thinking / chat_template_kwargs", "object", false, "关闭思考时**两个都传**：`\"thinking\": {\"type\": \"disabled\"}` 管 glm，`\"chat_template_kwargs\": {\"enable_thinking\": false}` 管 qwen，路由到哪个后端就是哪个生效。"],
  "a_max_tokens": ["max_tokens", "integer", true, "单次最多输出多少 token，**包含思考过程**。"],
  "a_system": ["system", "string", false, "系统提示词。"],
  "a_stream": ["stream", "boolean", false, "为 `true` 时以事件流返回（`message_start`、`content_block_delta` …）。"],
  "a_stop": ["stop_sequences", "array", false, "生成到停止词就结束；建议关掉思考后使用。"],
  "a_tools": ["tools", "array", false, "Anthropic 格式的工具定义（`input_schema`）；模型调用时返回 `tool_use` 内容块。"],
  "a_thinking": ["thinking", "object", false, "传 `{\"type\": \"disabled\"}` 关闭思考；默认开着，返回里会先有一个 `thinking` 内容块。"],
  "i_prompt": ["prompt", "string", true, "画面描述，最长 1,000 token。"],
  "i_size": ["size", "string", false, "`宽x高`，如 `\"1024x1024\"`（默认）、`\"512x512\"`。"],
  "i_n": ["n", "integer", false, "传多少都只返回 1 张。"],
  "i_fmt": ["response_format", "string", false, "固定返回 `b64_json`，传 `url` 也一样。"],
  "i_unsupported": ["seed / steps / cfg", "\u2014", false, "网关不转发这几个参数，传了也不生效。"],
  "v_prompt": ["prompt", "string", true, "视频描述，最长 7,000 字符。"],
  "v_seconds": ["seconds", "string", false, "时长，`\"4\"`～`\"15\"`，默认 `\"4\"`，超出范围直接报错。**写成字符串**。"],
  "v_size": ["size", "string", false, "只取宽高比：`\"1280x720\"` 横屏，`\"720x1280\"` 竖屏（默认 9:16）；清晰度由平台固定，短边 768。"],
  "v_image_url": ["image_url", "string", false, "参考图网址（须能公网访问），作为视频第一帧，即图生视频。"],
  "v_image_b64": ["image_base64", "string", false, "参考图的 base64（原图不超过 30 MB，JPG / PNG / WEBP / HEIC）；和 `image_url` 只能二选一。"],
  "v_negative": ["negative_prompt", "string", false, "不希望出现在画面里的内容。"],
  "v_seed": ["seed", "integer", false, "随机种子。"],
  "e_input": ["input", "string / array", true, "单条文本或文本数组；数组里每条单独计算、单独截断，互不影响。"],
  "e_dim_qwen": ["dimensions", "integer", false, "裁剪到指定维数；超过 2,560 时不报错，返回 2,560 维。"],
  "e_dim_bge": ["dimensions", "integer", false, "会被截断到指定维数，但 bge-m3 不是为裁剪维度训练的，截断后检索效果会下降，**不建议使用**。"],
  "e_fmt": ["encoding_format", "string", false, "不生效，始终返回浮点数组。"],
  "r_query": ["query", "string", true, "查询文本。"],
  "r_docs": ["documents", "array", true, "候选文档，字符串数组。"],
  "r_top": ["top_n", "integer", false, "只返回相关度最高的前 N 条；不传返回全部。"],
  "r_ret": ["return_documents", "boolean", false, "为 `true` 时每条结果附带原文（`document.text`）。"],
  "s_file": ["file", "file", true, "音频文件，WAV 或 MP3，用 multipart 上传。"],
  "s_fmt": ["response_format", "string", false, "`json`（默认）、`verbose_json`（多返回时长）、`text`、`srt`、`vtt`。"],
  "s_lang": ["language", "string", false, "语言提示，如 `zh`；后端会自动识别，传不传结果通常一样。"],
  "s_ignored": ["prompt / temperature", "\u2014", false, "接受但不生效。"],
  "t_input": ["input", "string", true, "要合成的文本。"],
  "t_voice": ["voice", "string", false, "音色库里的音色名；不传用默认音色。OpenAI 的 `alloy`、`echo` 等不存在，填了返回 400。"],
  "t_instr": ["instructions", "string", false, "语气、风格描述，如「用开心的语气」；效果有限。"],
  "t_fmt": ["response_format", "string", false, "始终返回 wav（24kHz 单声道），建议直接写 `\"wav\"`。"],
  "t_speed": ["speed", "number", false, "接受但不生效。"],
};

const PARAM_KEYS = {
  "smart-router": ["model", "messages", "max_tokens", "temp_router", "stream", "stop", "response_format", "tools", "think_router"],
  "glm": ["model", "messages", "max_tokens", "temp_01", "stream", "stop", "response_format", "tools", "think_glm"],
  "qwen": ["model", "messages", "max_tokens", "temp_open", "stream", "stop", "response_format", "tools", "think_qwen"],
  "glm-anthropic": ["model", "messages", "a_max_tokens", "a_system", "a_stream", "a_stop", "a_tools", "a_thinking"],
  "qwen-image": ["model", "i_prompt", "i_size", "i_n", "i_fmt", "i_unsupported"],
  "minimax-h3": ["model", "v_prompt", "v_seconds", "v_size", "v_image_url", "v_image_b64", "v_negative", "v_seed"],
  "bge-m3": ["model", "e_input", "e_dim_bge", "e_fmt"],
  "qwen3-embedding:4b": ["model", "e_input", "e_dim_qwen", "e_fmt"],
  "bge-reranker-v2-m3": ["model", "r_query", "r_docs", "r_top", "r_ret"],
  "qwen-asr": ["s_file", "model", "s_fmt", "s_lang", "s_ignored"],
  "cosy-voice": ["model", "t_input", "t_voice", "t_instr", "t_fmt", "t_speed"],
};

export const UNTESTED_PARAMS = new Set(['minimax-h3']);

export const callParams = (id) =>
  (PARAM_KEYS[id] || []).map((k) => ROWS[k]).filter(Boolean);

export const callNotes = (id) => CALL_SPEC[id]?.notes || [];
export const hasCallDoc = (id) => Boolean(CALL_SPEC[id]);
