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
print(msg.content[0].text)`,
    pyHead: 'import os\n\n',
  },

  image: {
    method: 'POST',
    path: '/v1/images/generations',
    body: (id) => ({
      model: id,
      prompt: '雨后的校园林荫道，清晨的光',
      size: '1024x1024',
      n: 1,
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
    n=1,
)
print(img.data[0].url)`,
    pyHead: 'import os\n\n',
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
    body: (id) => ({ model: id, input: '今天下午三点开会，地点在二楼会议室。' }),
    py: (id) => `import os, requests

KEY = os.environ["${KEY_ENV}"]

r = requests.post(
    "%BASE%/v1/audio/speech",
    headers={"Authorization": f"Bearer {KEY}"},
    json={
        "model": "${id}",
        "input": "今天下午三点开会，地点在二楼会议室。",
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
    ],
  },
  glm: {
    shape: 'chat',
    notes: ['本部署不支持图片输入：带图片的请求不报错，但模型看不到图片。'],
  },
  'glm-anthropic': {
    shape: 'anthropic',
    notes: [
      '和 `glm` 是同一个模型，只是换成 Anthropic Messages 协议；`max_tokens` 是必填项。',
      '鉴权头用 `Authorization: Bearer`，不是 Anthropic 官方的 `x-api-key`。',
    ],
  },
  qwen: { shape: 'chat', notes: [] },
  'gemma4:26b': { shape: 'chat', notes: [] },
  minimax: { shape: 'chat', notes: [] },
  'qwen-image': {
    shape: 'image',
    notes: ['返回的是图片链接，不是 base64。'],
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
    notes: ['本部署单次只处理前 2,048 token，超出的部分既不进模型也不报错，长文档要自己切。'],
  },
  'qwen3-embedding:4b': {
    shape: 'embedding',
    notes: [
      '默认 2,560 维，可以传 `dimensions` 裁剪到更小的维度。',
      '单次上限 4,096 token，超出同样是静默截断。',
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
      '不要传 `voice`：OpenAI 的 alloy、echo 这些音色在这里不存在，填了会返回 400。',
      '返回的是 wav（24kHz 单声道），不是 mp3。',
      '需要克隆音色时传 `ref_audio` 和 `ref_text`。',
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

export const callNotes = (id) => CALL_SPEC[id]?.notes || [];
export const hasCallDoc = (id) => Boolean(CALL_SPEC[id]);
