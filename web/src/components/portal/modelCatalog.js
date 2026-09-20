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
 *   2. 页面不写部署形态，也不写实际上游：模型全部是私有化部署，
 *      在每个模型上重复说一遍是噪音；上游是运维细节，调用方用不上。
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
 *        2026-09-20  大海捞针：在 97,611 token 的输入里把口令埋在 10%/50%/90%
 *                    三个深度，glm 全部答对；219,563 token、90% 深度也答对。
 *                    这证明的是「这段长度的内容确实被用上了」，比「请求被接受」
 *                    强得多——本平台存在静默截断，单看接受与否什么也证明不了。
 *        2026-09-20  glm 按部署方说明跑在官方 1M 档。实测与之一致且无冲突：
 *                    max_tokens 硬上限 131072 与官方完全相同，278,059 token
 *                    的 prompt 照收不误。该上游超限不拒绝而是照单全收，
 *                    所以只能从下面逼近、拿不到它自己报出的确切上限。
 *        2026-09-20  本地集群（Ollama + 自写转发层）读 usage.prompt_tokens：
 *                    gemma4 / bge-m3 报到 2048 封顶，qwen3-embedding 报到 4096。
 *                    bge-reranker **不是**这么测的——它的 usage 是空的，用的是
 *                    「把关键词放文档末尾、看相关度何时塌到基线」，得到的是
 *                    12000~14000 字之间的一个区间，不是精确的 token 数。
 *                    两种证据强度不同，别混着记。
 *                    另：prompt_tokens 停在某个数，只证明「上报值封顶」，
 *                    转发层封顶、编码器截断、分块统计都可能造成同样现象，
 *                    所以页面写「实测上报值封顶」而不是「上下文上限」。
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
    caps: { stream: true, tools: true, json: true, vision: true, reasoning: true, cache: true },
    category: 'chat',
    endpoints: ['openai'],
    summary: '按请求特征自动选择后端模型，调用方只写这一个 ID。',
    detail:
      '按请求特征在后端模型之间自动分发，调用方只写这一个 ID，后端变更时无需改动代码。代价是单次请求落在哪个模型上不可知——需要确定性时请直接指定具体模型 ID。',
    // 这里写的是模型家族名，不是调用时填的 ID，按正式写法大写。
    // 正文里「请改用 glm 或 qwen」那种指的是 ID，保持小写。
    params: '随后端而定（GLM 744B MoE / Qwen 35B MoE）',
    size: '随后端而定',
    context: '200,000 tokens（建议单次请求不超过）',
    io: '文本 → 文本',
  },
  {
    id: 'glm',
    name: 'GLM 模型接口',
    icon: 'Zhipu',
    inputs: ['文本'],
    outputs: ['文本'],
    caps: { stream: true, tools: true, json: true, vision: false, reasoning: true, cache: true },
    category: 'chat',
    endpoints: ['openai'],
    summary: '通用对话模型，当前指向 GLM-5.3。'
    ,
    // 版本会随上游升级，所以标题不写版本号，只在这里说当前指向谁。
    highlight: '接口指向的模型版本会随上游持续更新，模型 ID 保持不变。',
    detail:
      '通用对话模型，当前指向 GLM-5.3。适用于日常问答、改写、总结与代码辅助。上下文 100 万 token，为平台上最大，近 30 天平台上绝大部分对话请求由它承接。',
    // 这两个数是按 GLM-5.2 查的。接口指向的版本会变，换版本时记得一起更新。
    params: '约 744B 总参数 / 约 40B 激活（MoE）',
    size: '理论估算约 744 GB',
    context: '1,000,000 tokens（平台配置值）',
    maxOutput: '131,072 tokens（单次最多输出）',
    io: '文本 → 文本',
  },
  {
    id: 'glm-anthropic',
    name: 'GLM 模型接口（Anthropic 协议）',
    icon: 'Zhipu',
    inputs: ['文本'],
    outputs: ['文本'],
    // 这一行是在真正的 /v1/messages 上测的，不是拿 glm 的 OpenAI 那轮顶的。
    // json 标 'na'：Anthropic 协议没有 response_format 这个参数，
    // 属于「协议不提供」，不是模型不支持。
    caps: { stream: true, tools: true, json: 'na', vision: false, reasoning: true, cache: true },
    category: 'chat',
    endpoints: ['anthropic'],
    summary: '与 glm 同一模型，使用 Anthropic Messages 协议，当前指向 GLM-5.3。'
    ,
    highlight: '当前指向 GLM-5.3，后续会持续更新，模型 ID 保持不变。',
    detail:
      '与 glm 同一模型，当前指向 GLM-5.3，区别只在请求格式——但支持的参数不完全相同：Anthropic 协议没有 response_format，要结构化输出得用工具调用。给认 Anthropic 接口的客户端用——Claude Code、Anthropic 官方 SDK、以及一切只会发 /v1/messages 的工具。用 OpenAI SDK 的话请直接用 glm，不要用这个。',
    params: '约 744B 总参数 / 约 40B 激活（MoE）',
    size: '同 glm',
    context: '1,000,000 tokens（同 glm）',
    maxOutput: '131,072 tokens',
    io: '文本 → 文本',
  },
  {
    id: 'qwen',
    name: 'Qwen3.6-35B-A3B',
    icon: 'Qwen',
    inputs: ['文本', '图像'],
    outputs: ['文本'],
    // 数字不必重复：指标条里紧挨着的「上下文」就是那个值
    maxOutput: '与上下文共用',
    caps: { stream: true, tools: true, json: true, vision: true, reasoning: true, cache: true },
    category: 'chat',
    endpoints: ['openai'],
    summary: '混合专家架构的对话模型，激活参数少、吞吐高。',
    detail:
      '350 亿总参数的混合专家模型，单次推理约激活 30 亿参数。上下文 262,144 token，长文场景下仅次于 glm。会输出思考过程，字段名为 reasoning——注意不是 glm 使用的 reasoning_content。',
    params: '35B 总参数 / 3B 激活（MoE）',
    size: '官方 FP8 仓库 37.5 GB',
    context: '262,144 tokens',
    official: '262,144 原生，可扩至约 1M',
    io: '文本 → 文本',
  },
  {
    // 待复查（2026-09-20）：图像输入报 500 是转发层的问题，运维正在修。
    // 修好之后重跑 bin/probe-capabilities.py，把 vision 翻成 true，
    // 并删掉 detail 里那句「发图片请求会直接报 500」。
    id: 'gemma4:26b',
    name: 'Gemma 4 26B',
    icon: 'Gemma',
    inputs: ['文本'],
    outputs: ['文本'],
    caps: { stream: true, tools: true, json: true, vision: 'error', reasoning: false, cache: false },
    category: 'chat',
    endpoints: ['openai'],
    summary: '开放权重模型。上下文 2K，超出部分会被静默丢弃。',
    detail:
      '260 亿参数的开放权重模型。模型本身带视觉投影层，但当前发图片请求会直接报 500，实际用不了。开源许可允许自由微调和二次分发，适合需要审计模型来源、或者想在此基础上做领域微调的项目。注意上下文只有 2048 token（中文约 3,400 字），超出的部分会被静默丢弃，长文任务请改用 glm 或 qwen。',
    params: '26B 参数',
    size: '19 GB（Q4_K_M，含 1.2 GB 视觉投影层）',
    context: '2,048 tokens（实测：超出部分被丢弃）',
    official: '256K tokens',
    io: '文本 → 文本',
  },
  {
    id: 'qwen-image',
    name: 'Qwen-Image',
    icon: 'Qwen',
    inputs: ['文本'],
    outputs: ['图像'],
    category: 'image',
    endpoints: ['openai'],
    summary: '文生图，支持中文提示词与画面内文字渲染。',
    detail:
      '按文字描述生成图片。相比多数开源出图模型，对中文提示词的理解与画面内中文渲染明显更好，制作海报、配图、示意图时无需先将提示词译为英文。',
    params: '未公布',
    context: null,
    io: '文本 → 图像',
  },
  {
    id: 'qwen-asr',
    name: 'Qwen3-ASR',
    icon: 'Qwen',
    inputs: ['音频'],
    outputs: ['文本'],
    category: 'audio',
    endpoints: ['openai'],
    summary: '语音转文字，适用于会议录音与访谈整理。',
    detail:
      '将音频转为文本，支持中文及中英混合口语。常见用途包括会议录音转写、访谈整理与视频字幕。接口兼容 OpenAI 的 audio/transcriptions。',
    params: '未公布',
    context: null,
    io: '音频 → 文本',
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
      '将文本合成为自然语音，可依据一小段参考音频复刻音色。适用于播报、有声材料与数字人配音。接口兼容 OpenAI 的 audio/speech。',
    params: '未公布',
    context: null,
    io: '文本 → 音频',
  },
  {
    id: 'minimax-h3',
    name: 'MiniMax H3',
    icon: 'Minimax',
    inputs: ['文本', '图像'],
    outputs: ['视频'],
    category: 'video',
    endpoints: ['openai-video'],
    summary: '文生视频 / 图生视频，异步返回结果。',
    detail:
      '按文字描述生成视频，也支持由单张图片生成。生成耗时以分钟计，使用异步任务接口：提交后取回任务 ID，再轮询结果，不要按同步请求设置超时。进度可在「使用记录 → 任务」查看。',
    params: '未公布',
    context: null,
    io: '文本 / 图像 → 视频',
  },
  {
    id: 'bge-m3',
    name: 'BGE-M3',
    icon: 'BAAI',
    inputs: ['文本'],
    outputs: ['向量'],
    category: 'retrieval',
    endpoints: ['openai'],
    summary: '多语言向量模型，用于检索与知识库。超长文本会被静默截断。',
    detail:
      '把文本转成向量，用于语义检索、相似度匹配、RAG 知识库。一百多种语言共用同一个向量空间，中文查询可以直接召回英文文档。输出 1024 维。只给到 2048 token（中文约 3,400 字，随内容浮动），超出的部分会被直接丢掉且不报错——拿到的向量只代表截断后的那一段，长文档必须自己先切段。',
    params: '约 568M 参数',
    size: '1.2 GB',
    context: '2,048 tokens（实测：超出部分被丢弃）',
    official: '8,192 tokens',
    io: '文本 → 1024 维向量',
  },
  {
    id: 'qwen3-embedding:4b',
    name: 'Qwen3-Embedding 4B',
    icon: 'Qwen',
    inputs: ['文本'],
    outputs: ['向量'],
    category: 'retrieval',
    endpoints: ['openai'],
    summary: '向量模型，可处理 BGE-M3 两倍长度的文本。',
    detail:
      '同样用于将文本转为向量。可用 4096 token（中文约 8,000 字），为 BGE-M3 的两倍，同一份文档需要切分的次数更少，但超出部分同样被静默丢弃。参数量更大，因此更慢、更占显存。',
    params: '4B 参数',
    size: '2.5 GB',
    context: '4,096 tokens（实测：超出部分被丢弃）',
    official: '32K tokens',
    io: '文本 → 向量',
  },
  {
    id: 'bge-reranker-v2-m3',
    name: 'BGE-Reranker-v2-M3',
    icon: 'BAAI',
    inputs: ['文本'],
    outputs: ['分数'],
    category: 'retrieval',
    endpoints: ['openai'],
    summary: '重排模型，对向量召回结果做二次精排。',
    detail:
      '接在向量检索之后使用：先由 BGE-M3 粗召回数十条，再逐条与问题比对并重新打分，将最相关的排到前面。它不产出向量，只输出相关性分数，单独使用没有意义。窗口由每个「问题＋文档」对各自占用，并非所有候选文档共享一份。',
    params: '约 568M 参数',
    size: '约 1.2 GB',
    context: '实测在 12,000～14,000 字之间被截断',
    io: '（问题、文档）→ 相关性分数',
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

/*
 * 待下线、不在页面上露面的模型。
 * 只从目录里删掉不够：那样它会掉进「其他」分类，变成一行光秃秃的 ID，
 * 反而更像「有这么个能用的模型」，更容易被新代码抄走。
 */
export const HIDDEN = new Set([
  // 这个别名实际打到 Qwen3.6-35B-A3B，与名字不符，运维计划删除
  'minimax',
]);

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
      // 目录没跟上时排到最后，不要插在维护过的模型中间
      order: 9999,
      unlisted: true,
    }
  );
}
