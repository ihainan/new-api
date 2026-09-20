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
 *   3. context 是「这套部署实际给到的」，official 是「模型本身的规格」。
 *      两者不一致时页面会并排显示——本地集群的 gemma4/bge-m3 被压到 2048，
 *      只有模型能力的零头，用的人必须看得见。
 *      context / params 只填有据可查的。自部署模型的上下文由上游启动参数决定，
 *      不知道就留空，页面会显示「以上游部署为准」——那是实话，编一个数字不是。
 *      实测办法见 bin/probe-upstream-context.py：直连上游，用超限的 max_tokens
 *      让服务端在推理前报出真实上限，不产生计费。
 *      实测记录：
 *        2026-09-19  smart-router / qwen / minimax 上游自报 262144。
 *        2026-09-20  glm 收下 278059 token 的 prompt 仍返回 200，故下限
 *                    至少 272K，比其余模型的 262144 还大；上游从不报出
 *                    确切上下文，所以写「≥」而不是猜一个整数。
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
];

// icon 取 @lobehub/icons 的导出名，在 PortalModels.jsx 里映射成组件。
// 认不出来的填 null，显示中性占位，不给 A 家的模型挂 B 家的标。
// 页面不写厂商名（用户要求），所以这里也没有 vendor 字段。
export const MODELS = [
  {
    id: 'smart-router',
    name: '智能路由',
    icon: 'brand',
    category: 'chat',
    endpoints: ['openai'],
    summary: '不确定用哪个模型时的默认入口，网关替你选后端。',
    detail:
      '按请求特征（提示词长度、是否带工具调用、是否需要长链路推理）在后端模型之间自动分发，调用方只写这一个 ID。适合刚接入、还没摸清各模型脾气的场景，也适合不想为模型升级改代码的服务。',
    params: '随实际路由到的模型而定',
    context: '256K tokens',
    io: '文本 → 文本',
    upstream: '由路由服务按请求动态选择',
  },
  {
    id: 'glm',
    name: 'GLM-5.2',
    icon: 'Zhipu',
    category: 'chat',
    endpoints: ['openai'],
    summary: '平台调用量最大的通用对话模型，私有化部署。',
    detail:
      '日常问答、改写、总结、代码辅助的主力。FP8 量化后私有化部署在算力集群上，数据不出内网。近 30 天承接了平台绝大部分对话请求，稳定性有实际流量背书。',
    params: 'FP8 量化私有化部署',
    context: '≥ 272K tokens（实测未触顶）',
    official: '1,000,000 tokens',
    maxOutput: '131,072 tokens',
    io: '文本 → 文本',
    upstream: 'glm-5.2-fp8-private（私有化推理接入点）',
  },
  {
    id: 'glm-anthropic',
    name: 'GLM-5.2（Anthropic 协议）',
    icon: 'Zhipu',
    category: 'chat',
    endpoints: ['anthropic'],
    summary: '和 glm 同一个模型，换成 Anthropic Messages 协议。',
    detail:
      '后端与 glm 是同一个部署，区别只在请求格式。给认 Anthropic 接口的客户端用——Claude Code、Anthropic 官方 SDK、以及一切只会发 /v1/messages 的工具。用 OpenAI SDK 的话请直接用 glm，不要用这个。',
    params: '同 glm',
    context: '≥ 272K tokens（同 glm）',
    official: '1,000,000 tokens',
    maxOutput: '131,072 tokens',
    io: '文本 → 文本',
    upstream: '同 glm（同一推理接入点）',
  },
  {
    id: 'qwen',
    name: 'Qwen3.6-35B-A3B',
    icon: 'Qwen',
    category: 'chat',
    endpoints: ['openai'],
    summary: '混合专家架构，激活参数小、吞吐高的对话模型。',
    detail:
      '350 亿总参数的 MoE 模型，每次推理只激活约 30 亿，同样算力下比同级稠密模型快得多。适合批量处理、对延迟敏感的在线场景，以及需要跑大量请求的离线任务。',
    params: '35B 总参数 / 3B 激活（MoE）',
    context: '262,144 tokens',
    official: '262,144 原生，可扩至约 1M',
    io: '文本 → 文本',
    upstream: 'Qwen3.6-35B-A3B（自建集群直连）',
  },
  {
    id: 'minimax',
    name: 'minimax',
    icon: 'Qwen',
    category: 'chat',
    endpoints: ['openai'],
    summary: '当前由 Qwen3.6-35B-A3B 承接，与名字不一致。',
    detail:
      '这个别名的名字和它实际调到的模型对不上：网关当前把它映射到了 Qwen3.6-35B-A3B，效果等同于 qwen。新接入请直接写 qwen，这个 ID 只为兼容已经写死它的旧代码而保留。',
    params: '35B 总参数 / 3B 激活（MoE）',
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
    category: 'chat',
    endpoints: ['openai'],
    summary: '开放权重模型，跑在本地集群上。上下文只有 2K，注意截断。',
    detail:
      '260 亿参数的开放权重模型，部署在本地推理集群。开源许可允许自由微调和二次分发，适合需要审计模型来源、或者想在此基础上做领域微调的项目。注意当前部署的上下文只有 2048 token（约 3000 个汉字），超出的部分会被静默丢弃，长文任务请改用 glm 或 qwen。',
    params: '26B 参数',
    context: '2,048 tokens（部署上限）',
    official: '256K tokens',
    io: '文本 → 文本',
    upstream: 'gemma4:26b（本地集群部署）',
  },
  {
    id: 'qwen-image',
    name: 'Qwen-Image',
    icon: 'Qwen',
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
    category: 'retrieval',
    endpoints: ['openai'],
    summary: '多语言向量模型，做检索和知识库的第一步。超长文本会被静默截断。',
    detail:
      '把文本转成向量，用于语义检索、相似度匹配、RAG 知识库。一百多种语言共用同一个向量空间，中文查询可以直接召回英文文档。输出 1024 维。当前部署的上下文是 2048 token（约 3000 个汉字），超出的部分会被直接丢掉且不报错——长文档必须自己先切段，否则拿到的是残缺向量。',
    params: '约 568M 参数',
    context: '2,048 tokens（部署上限）',
    official: '8,192 tokens',
    io: '文本 → 1024 维向量',
    upstream: 'bge-m3（本地集群部署）',
  },
  {
    id: 'qwen3-embedding:4b',
    name: 'Qwen3-Embedding 4B',
    icon: 'Qwen',
    category: 'retrieval',
    endpoints: ['openai'],
    summary: '更大的向量模型，能吃下 BGE-M3 两倍长的文本。',
    detail:
      '同样是把文本转向量，上下文比 BGE-M3 大一倍（4096 token，约 6000 个汉字），同样的文档少切几刀，但一样会静默截断。代价是更慢、更占显存。追求召回质量选它，追求吞吐选 BGE-M3。',
    params: '4B 参数',
    context: '4,096 tokens（部署上限）',
    official: '32K tokens',
    io: '文本 → 向量',
    upstream: 'qwen3-embedding:4b（本地集群部署）',
  },
  {
    id: 'bge-reranker-v2-m3',
    name: 'BGE-Reranker-v2-M3',
    icon: 'BAAI',
    category: 'retrieval',
    endpoints: ['openai'],
    summary: '重排模型，给向量召回的结果做第二轮精排。',
    detail:
      '接在向量检索后面用：先用 BGE-M3 粗召回几十条，再让它逐条和问题比对、重新打分，把最相关的排到前面。它不产出向量，只输出相关性分数，单独用没有意义。单篇文档可以到 8192 token，比 BGE-M3 宽裕得多。',
    params: '约 568M 参数',
    context: '8,192 tokens',
    io: '（问题, 文档）→ 相关性分数',
    upstream: 'bge-reranker-v2-m3（本地集群部署）',
  },
];

// 协议标签。endpoints 来自 /api/pricing 的 supported_endpoint_types，
// 目录里的值是对照渠道类型写的，两者不一致时以接口返回为准。
export const ENDPOINT_LABELS = {
  openai: 'OpenAI 兼容',
  anthropic: 'Anthropic',
  'openai-video': '异步视频任务',
  'openai-image': '图像接口',
  'openai-audio': '音频接口',
  jina: 'Jina',
};

// 数组顺序就是页面内的展示顺序：推荐入口在前，兼容用的旧别名垫底。
// /api/pricing 的返回顺序不可控，不能拿来当展示顺序。
const BY_ID = new Map(MODELS.map((m, i) => [m.id, { ...m, order: i }]));

// 网关上了新模型但这个文件还没跟上时的兜底：只显示 ID 和分组，
// 并在页面上标出来「待补充介绍」，而不是把它藏掉。
export function describe(id) {
  return (
    BY_ID.get(id) || {
      id,
      name: id,
      icon: null,
      category: 'chat',
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
