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
 * 模型目录（手工维护）。
 *
 * 为什么写死在前端：网关的 models 元数据表是空的，/api/pricing 只返回模型 ID、
 * 分组和倍率，拿不到模态、参数规模、上游实际模型这些员工真正需要知道的信息。
 * 与其在页面上堆一排只有 ID 的方块，不如把介绍写在这里。
 *
 * 维护约定
 *   1. 平台上下模型时，同步改这个文件；漏改的后果是「网关有、页面没有」，
 *      页面对 /api/pricing 里存在但这里缺失的模型会兜底显示，不会整条消失。
 *   2. upstream 字段抄渠道配置里的 model_mapping，不要凭模型别名猜。
 *      别名和上游经常对不上（见下面 minimax 的 note）。
 *   3. size 是权重体积。Ollama 拉的几个用官方库的下载体积；托管的按参数量×精度
 *      估算（FP8 每参数 1 字节）。本地集群那层把 Ollama 原生 /api/tags 挡掉了，
 *      拿不到真实落盘体积，所以估算的必须在文案里说明是估的。
 *   4. caps 是实测的能力矩阵，来自 bin/probe-capabilities.py。键缺失＝没测过，
 *      页面显示「未测」；false 才是实测不支持。两者不能混——把没测过的写成
 *      不支持，和编一个规格一样是撒谎。
 *      探测必须用 tool_choice="required"：auto 测的是模型这次想不想调工具，
 *      不是它能不能，按 auto 的结果会把 smart-router 和 qwen 误判成不支持。
 *   5. context 是「这套部署实际给到的」，official 是「模型本身的规格」。
 *      两者不一致时页面会并排显示——本地集群的 gemma4/bge-m3 被压到 2048，
 *      只有模型能力的零头，用的人必须看得见。
 *      context / params 只填有据可查的。自部署模型的上下文由上游启动参数决定，
 *      不知道就留空，页面会显示「以上游部署为准」——那是实话，编一个数字不是。
 *      实测办法见 bin/probe-upstream-context.py：直连上游，用超限的 max_tokens
 *      让服务端在推理前报出真实上限，不产生计费。
 *      实测记录：
 *        2026-09-19  smart-router / qwen / minimax 上游自报 262144。
 *        2026-09-20  glm 按部署方说明跑在官方 1M 档。实测与之一致且无冲突：
 *                    max_tokens 硬上限 131072 与官方完全相同，278,059 token
 *                    的 prompt 照收不误。该上游超限不拒绝而是照单全收，
 *                    所以只能从下面逼近、拿不到它自己报出的确切上限。
 *        2026-09-20  本地集群（Ollama + 自写转发层）读 usage.prompt_tokens：
 *                    gemma4 / bge-m3 卡在 2048，qwen3-embedding 卡在 4096，
 *                    bge-reranker 到 8192。前三个远低于模型本身的能力，
 *                    且超出不报错、静默截断——页面必须写明。
 *
 * 数据来源：channels 表的 model_mapping + abilities 表（2026-09-19 核对）。
 */

export const CATEGORIES = [
  { key: 'chat', label: '对话与推理' },
  { key: 'image', label: '图像生成' },
  { key: 'audio', label: '语音' },
  { key: 'video', label: '视频生成' },
  { key: 'retrieval', label: '向量与重排' },
  // 目录还没覆盖到的模型落这里，不硬猜类别
  { key: 'other', label: '其他' },
];

// icon 取 @lobehub/icons 的导出名，在 PortalModels.jsx 里映射成组件。
// 认不出来的填 null，显示中性占位，不给 A 家的模型挂 B 家的标。
// 页面不写厂商名（用户要求），所以这里也没有 vendor 字段。
export const MODELS = [
  {
    id: 'smart-router',
    name: '智能路由',
    icon: 'brand',
    inputs: ['文本', '图像'],
    outputs: ['文本'],
    maxOutput: '与上下文共用 262,144',
    caps: { stream: true, tools: true, json: true, vision: true, reasoning: true, cache: true },
    category: 'chat',
    endpoints: ['openai'],
    summary: '不确定用哪个模型时的默认入口，网关替你选后端。',
    detail:
      '按请求特征在后端模型之间自动分发，调用方只写这一个 ID，后端换了也不必改代码。代价是你不知道某一次请求实际落在哪个模型上——要确定性就直接写具体模型 ID。',
    params: '随后端而定（glm 744B MoE / qwen 35B MoE）',
    size: '随后端而定',
    deployment: '随实际路由到的模型而定',
    context: '200K tokens',
    io: '文本 → 文本',
    upstream: '由路由服务在 glm 与 qwen 之间动态选择',
  },
  {
    id: 'glm',
    name: 'GLM-5.2',
    icon: 'Zhipu',
    inputs: ['文本'],
    outputs: ['文本'],
    caps: { stream: true, tools: true, json: true, vision: false, reasoning: true, cache: true },
    category: 'chat',
    endpoints: ['openai'],
    summary: '平台调用量最大的通用对话模型，私有化部署。',
    detail:
      '日常问答、改写、总结、代码辅助都能用。100 万 token 的上下文是平台上最大的，整个代码仓库或几百页文档可以一次塞进去。FP8 量化后私有化部署在算力集群上，数据不出内网。近 30 天平台上绝大部分对话请求打的是它。',
    params: '约 744B 总参数 / 约 40B 激活（MoE）',
    size: 'FP8 权重约 744 GB',
    deployment: 'FP8 量化，私有化部署',
    context: '1,000,000 tokens',
    maxOutput: '131,072 tokens',
    io: '文本 → 文本',
    upstream: 'glm-5.2-fp8-private（私有化推理接入点）',
  },
  {
    id: 'glm-anthropic',
    name: 'GLM-5.2（Anthropic 协议）',
    icon: 'Zhipu',
    inputs: ['文本'],
    outputs: ['文本'],
    caps: { stream: true, tools: true, json: true, vision: false, reasoning: true, cache: true },
    category: 'chat',
    endpoints: ['anthropic'],
    summary: '和 glm 同一个模型，换成 Anthropic Messages 协议。',
    detail:
      '后端与 glm 是同一个部署，区别只在请求格式。给认 Anthropic 接口的客户端用——Claude Code、Anthropic 官方 SDK、以及一切只会发 /v1/messages 的工具。用 OpenAI SDK 的话请直接用 glm，不要用这个。',
    params: '约 744B 总参数 / 约 40B 激活（MoE）',
    size: '同 glm',
    deployment: '与 glm 同一部署',
    context: '1,000,000 tokens（同 glm）',
    maxOutput: '131,072 tokens',
    io: '文本 → 文本',
    upstream: '同 glm（同一推理接入点）',
  },
  {
    id: 'qwen',
    name: 'Qwen3.6-35B-A3B',
    icon: 'Qwen',
    inputs: ['文本', '图像'],
    outputs: ['文本'],
    maxOutput: '与上下文共用 262,144',
    caps: { stream: true, tools: true, json: true, vision: true, reasoning: false, cache: true },
    category: 'chat',
    endpoints: ['openai'],
    summary: '混合专家架构，激活参数小、吞吐高的对话模型。',
    detail:
      '350 亿总参数的混合专家模型，每次推理只激活约 30 亿参数。上下文 262,144 token，是平台上仅次于 glm 的长文选择。',
    params: '35B 总参数 / 3B 激活（MoE）',
    size: 'FP8 权重约 37.5 GB',
    context: '262,144 tokens',
    official: '262,144 原生，可扩至约 1M',
    io: '文本 → 文本',
    upstream: 'Qwen3.6-35B-A3B（自建集群直连）',
  },
  {
    id: 'minimax',
    name: 'minimax',
    icon: 'Qwen',
    inputs: ['文本', '图像'],
    outputs: ['文本'],
    maxOutput: '与上下文共用 262,144',
    caps: { stream: true, tools: true, json: true, vision: true, reasoning: false, cache: true },
    category: 'chat',
    endpoints: ['openai'],
    summary: '当前由 Qwen3.6-35B-A3B 承接，与名字不一致。',
    detail:
      '这个别名的名字和它实际调到的模型对不上：网关当前把它映射到了 Qwen3.6-35B-A3B，效果等同于 qwen。新接入请直接写 qwen，这个 ID 只为兼容已经写死它的旧代码而保留。',
    params: '35B 总参数 / 3B 激活（MoE）',
    size: 'FP8 权重约 37.5 GB',
    context: '262,144 tokens',
    official: '262,144 原生，可扩至约 1M',
    io: '文本 → 文本',
    upstream: 'Qwen3.6-35B-A3B（自建集群直连）',
    note: '别名与实际模型不一致，新代码请用 qwen。',
  },
  {
    id: 'gemma4:26b',
    name: 'Gemma 4 26B',
    icon: 'Gemma',
    inputs: ['文本'],
    outputs: ['文本'],
    caps: { stream: true, tools: true, json: true, vision: false, reasoning: false, cache: false },
    category: 'chat',
    endpoints: ['openai'],
    summary: '开放权重模型，跑在本地集群上。上下文只有 2K，注意截断。',
    detail:
      '260 亿参数的开放权重模型，部署在本地推理集群。模型本身带视觉投影层，但当前部署发图片请求会直接报 500，实际用不了。开源许可允许自由微调和二次分发，适合需要审计模型来源、或者想在此基础上做领域微调的项目。注意当前部署的上下文只有 2048 token（中文约 3,400 字），超出的部分会被静默丢弃，长文任务请改用 glm 或 qwen。',
    params: '26B 参数',
    size: '19 GB（Q4_K_M，含 1.2 GB 视觉投影层）',
    context: '2,048 tokens（部署上限，中文约 3,400 字）',
    official: '256K tokens',
    io: '文本 → 文本',
    upstream: 'gemma4:26b（本地集群部署）',
  },
  {
    id: 'qwen-image',
    name: 'Qwen-Image',
    icon: 'Qwen',
    inputs: ['文本'],
    outputs: ['图像'],
    category: 'image',
    endpoints: ['openai'],
    summary: '文生图，中文提示词和画面内文字渲染都能处理。',
    detail:
      '按文字描述生成图片。相比多数开源出图模型，它对中文提示词的理解和在画面里写中文字的能力明显更好，做海报、配图、示意图时不必先把提示词翻成英文。',
    params: '未公布',
    context: null,
    io: '文本 → 图像',
    upstream: 'zgcai-qwen-image（经 model-bridge）',
  },
  {
    id: 'qwen-asr',
    name: 'Qwen3-ASR',
    icon: 'Qwen',
    inputs: ['音频'],
    outputs: ['文本'],
    category: 'audio',
    endpoints: ['openai'],
    summary: '语音转文字，会议录音、访谈整理都能用。',
    detail:
      '把音频转成文本，支持中文和中英夹杂的口语。典型用法是会议录音转写、访谈整理、给视频配字幕。接口兼容 OpenAI 的 audio/transcriptions。',
    params: '未公布',
    context: null,
    io: '音频 → 文本',
    upstream: 'zgcai-qwen3-asr（经 model-bridge）',
  },
  {
    id: 'cosy-voice',
    name: 'CosyVoice',
    icon: 'Alibaba',
    inputs: ['文本', '音频'],
    outputs: ['音频'],
    category: 'audio',
    endpoints: ['openai'],
    summary: '文字转语音，支持音色复刻。',
    detail:
      '把文本合成为自然语音，可以用一小段参考音频复刻音色。适合做播报、有声材料、数字人配音。接口兼容 OpenAI 的 audio/speech。',
    params: '未公布',
    context: null,
    io: '文本 → 音频',
    upstream: 'zgcai-cosyvoice（经 model-bridge）',
  },
  {
    id: 'minimax-h3',
    name: 'MiniMax H3',
    icon: 'Minimax',
    inputs: ['文本', '图像'],
    outputs: ['视频'],
    category: 'video',
    endpoints: ['openai-video'],
    summary: '文生视频 / 图生视频，异步出片。',
    detail:
      '按文字描述生成一段视频，也可以给一张图让它动起来。生成耗时以分钟计，走的是异步任务接口：提交后拿任务 ID，再轮询结果，不要按同步请求写超时。进度可以在「使用记录 → 任务」里看。',
    params: '未公布',
    context: null,
    io: '文本 / 图像 → 视频',
    upstream: 'zgcai-minimax-h3（经 model-bridge）',
  },
  {
    id: 'bge-m3',
    name: 'BGE-M3',
    icon: 'BAAI',
    inputs: ['文本'],
    outputs: ['向量'],
    category: 'retrieval',
    endpoints: ['openai'],
    summary: '多语言向量模型，做检索和知识库的第一步。超长文本会被静默截断。',
    detail:
      '把文本转成向量，用于语义检索、相似度匹配、RAG 知识库。一百多种语言共用同一个向量空间，中文查询可以直接召回英文文档。输出 1024 维。当前部署只给到 2048 token（中文约 3,400 字，随内容浮动），超出的部分会被直接丢掉且不报错——拿到的向量只代表截断后的那一段，长文档必须自己先切段。',
    params: '约 568M 参数',
    size: '1.2 GB',
    context: '2,048 tokens（部署上限，中文约 3,400 字）',
    official: '8,192 tokens',
    io: '文本 → 1024 维向量',
    upstream: 'bge-m3（本地集群部署）',
  },
  {
    id: 'qwen3-embedding:4b',
    name: 'Qwen3-Embedding 4B',
    icon: 'Qwen',
    inputs: ['文本'],
    outputs: ['向量'],
    category: 'retrieval',
    endpoints: ['openai'],
    summary: '更大的向量模型，能吃下 BGE-M3 两倍长的文本。',
    detail:
      '同样是把文本转向量。当前部署给到 4096 token（中文约 8,000 字），是 BGE-M3 的两倍，同样的文档少切几刀，但超出部分一样被静默丢弃。参数量更大，因此更慢、更占显存。',
    params: '4B 参数',
    size: '2.5 GB',
    context: '4,096 tokens（部署上限，中文约 8,000 字）',
    official: '32K tokens',
    io: '文本 → 向量',
    upstream: 'qwen3-embedding:4b（本地集群部署）',
  },
  {
    id: 'bge-reranker-v2-m3',
    name: 'BGE-Reranker-v2-M3',
    icon: 'BAAI',
    inputs: ['文本'],
    outputs: ['分数'],
    category: 'retrieval',
    endpoints: ['openai'],
    summary: '重排模型，给向量召回的结果做第二轮精排。',
    detail:
      '接在向量检索后面用：先用 BGE-M3 粗召回几十条，再让它逐条和问题比对、重新打分，把最相关的排到前面。它不产出向量，只输出相关性分数，单独用没有意义。8,192 token 是问题加文档的总预算，不是每篇文档各自的额度。',
    params: '约 568M 参数',
    size: '约 1.2 GB',
    context: '8,192 tokens',
    io: '（问题, 文档）→ 相关性分数',
    upstream: 'bge-reranker-v2-m3（本地集群部署）',
  },
];

// 协议标签。endpoints 来自 /api/pricing 的 supported_endpoint_types，
// 目录里的值是对照渠道类型写的，两者不一致时以接口返回为准。
export const ENDPOINT_LABELS = {
  // 取值对齐 constant/endpoint_type.go，别自己造名字：认不出来的会把
  // 内部枚举原样显示给员工看。
  openai: 'OpenAI 兼容',
  'openai-response': 'OpenAI Responses',
  'openai-response-compact': 'OpenAI Responses',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  'jina-rerank': '重排接口',
  'image-generation': '图像生成接口',
  embeddings: '向量接口',
  'openai-video': '异步视频任务',
};

const BY_ID = new Map(MODELS.map((m, i) => [m.id, { ...m, order: i }]));

// 网关上了新模型但这个文件还没跟上时的兜底：只显示 ID 和分组，
// 并在页面上标出来「待补充介绍」，而不是把它藏掉。
export function describe(id) {
  return (
    BY_ID.get(id) || {
      id,
      name: id,
      icon: null,
      category: 'other',
      endpoints: [],
      summary: '',
      detail: '',
      params: null,
      context: null,
      io: null,
      upstream: null,
      // 目录没跟上时排到最后，不要插在维护过的模型中间
      order: 9999,
      unlisted: true,
    }
  );
}
