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
    // 取决于落到哪个后端，本来就没有一个固定值
    maxOutput: 'GLM 131,072 tokens；Qwen 与上下文共用',
    caps: { stream: true, tools: true, json: true, vision: true, reasoning: true, cache: true },
    category: 'chat',
    endpoints: ['openai'],
    summary: '两院智能路由入口，按请求内容自动选择底层模型。',
    detail:
      '两院智能路由入口，会根据请求内容自动选择底层模型。目前接入 GLM-5.2（不支持图片输入）和 Qwen3.6-35B-A3B（支持图片输入），分发规则如下：日常问答、简单任务以及带图片的请求由 Qwen3.6-35B-A3B 处理，代码、金融与行情分析、需要多步推理的问题交给 GLM-5.2。两个后端的上下文和单次输出上限不同，下面的规格按后端分别列出。如果某类任务必须固定在某个模型上，请直接填写该模型的 ID。`smart-router` 是平台维护的稳定别名，底层模型和分发规则调整时这个 ID 不变。',
    // 这里写的是模型家族名，不是调用时填的 ID，按正式写法大写。
    // 正文里「请改用 glm 或 qwen」那种指的是 ID，保持小写。
    params: 'GLM 约 753B（MoE）；Qwen 35B 总参数 / 3B 激活',
    size: '官方 FP8 权重：GLM 约 756 GB，Qwen 约 37.5 GB',
    context: 'Qwen 262,144；GLM 1,000,000 tokens',
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
    summary: '平台的通用对话模型，当前指向 GLM-5.2。'
    ,
    // 版本会随上游升级，所以标题不写版本号，只在这里说当前指向谁。
    detail:
      '当前指向 GLM-5.2，适用于日常问答、文本改写、内容总结和代码辅助。上下文 1M token，适合长文档和跨文件的代码分析；具体能放多少仍要按 token 估算，不是所有仓库都塞得下。**不支持图片输入：带图片的请求不会报错，但模型看不到图片内容。**`glm` 是平台维护的稳定别名，上游升级模型版本时这个 ID 不变。',
    // 这两个数是按 GLM-5.2 查的。接口指向的版本会变，换版本时记得一起更新。
    params: '约 753B 总参数（MoE：256 个专家，每 token 激活 8 个 + 1 个共享）',
    size: '官方 FP8 权重约 756 GB',
    context: '1,000,000 tokens（平台配置值）',
    maxOutput: '131,072 tokens（单次输出上限）',
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
    summary: '与 `glm` 是同一个模型，改用 Anthropic Messages 协议，当前指向 GLM-5.2。'
    ,
    detail:
      '模型与 `glm` 完全相同（当前为 GLM-5.2），区别只在请求格式，支持的参数也不完全一致。Anthropic 协议没有 OpenAI 的 `response_format`；传 `output_config.format` 不会报错，但**实测并不生效**，给了严格 schema 仍会返回自然语言，需要可靠的结构化输出请改用工具调用。这个 ID 是为只支持 Anthropic 接口的客户端准备的，例如 Claude Code、Anthropic 官方 SDK，以及其他只发送 `/v1/messages` 的工具；使用 OpenAI SDK 时请直接选择 `glm`。`glm-anthropic` 是平台维护的稳定别名，指向的模型版本与 `glm` 同步。',
    params: '约 753B 总参数（MoE：256 个专家，每 token 激活 8 个 + 1 个共享）',
    size: '官方 FP8 权重约 756 GB',
    context: '1,000,000 tokens（平台配置值）',
    maxOutput: '131,072 tokens（单次输出上限）',
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
    summary: '混合专家架构的对话模型，单次推理只激活一小部分参数。',
    detail:
      '总参数 35B，单次推理约激活 3B，计算量低于同规模的稠密模型。上下文 256K token，输入和输出共用这一个窗口。该模型会输出思考过程，放在 `reasoning` 字段里，**不是更常见的 `reasoning_content`**，解析时注意区分。`qwen` 是平台维护的稳定别名，上游升级模型版本时这个 ID 不变。',
    params: '35B 总参数 / 3B 激活（MoE）',
    size: '官方 FP8 权重约 37.5 GB',
    context: '262,144 tokens',
    official: '262,144 tokens（官方称可扩展至约 1,010,000，本平台未开启）',
    io: '文本 → 文本',
  },
  {
    id: 'gemma4:26b',
    name: 'Gemma 4 26B',
    icon: 'Gemma',
    inputs: ['文本', '图像'],
    outputs: ['文本'],
    caps: { stream: true, tools: true, json: true, vision: true, reasoning: true, cache: false },
    category: 'chat',
    endpoints: ['openai'],
    summary: '开放权重模型，支持图片输入。上下文 4K token。',
    detail:
      '总参数 26B，单次推理约激活 4B，支持图片输入。它会先输出思考过程（字段名 `reasoning_content`）再给出正文，因此 **`max_tokens` 需要留足余量，否则思考过程会占满额度，正文返回为空**。权重以 Apache-2.0 许可公开，可自由微调与再分发。平台接受 4,096 token 以内的请求，**超长请求不会报错**，但实测 `usage.prompt_tokens` 在约 2,048 封顶，超出的内容是否进入模型未经证实，长文本任务请改用 `glm` 或 `qwen`。',
    params: '约 26B 总参数 / 约 4B 激活（MoE）',
    size: '官方 BF16 权重约 52 GB',
    context: '4,096 tokens（超出不报错；实测上报值在 2,048 封顶）',
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
    summary: '文生图模型，当前指向 Qwen-Image-2.0，中文提示词与画面内文字均可处理。',
    detail:
      '当前指向 Qwen-Image-2.0，根据文字描述生成图片。**本平台默认**输出 1024×1024、采样 30 步。中文提示词可以直接使用，画面内的中文也能生成，做海报、配图和示意图不必先译成英文；复杂文案仍需人工校对，生成模型不保证逐字正确。模型规格允许最长 1,000 token 的提示词。',
    // 2.0 的权重官方没有公开发布（Hugging Face 上 Qwen 官方最新的公开权重
    // 仍是 20B 的 Qwen-Image-2512），所以参数量写「未公开」是事实而非偷懒。
    params: '官方未公开',
    context: '提示词最长 1,000 tokens（模型规格）',
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
      '当前指向 Qwen3-ASR-1.7B，将音频转写为文本，支持中文以及中英混合口语，常用于会议录音、访谈整理和视频字幕。**超过 145 秒的音频由平台在静音处切段**，分别转写后拼接返回，这个阈值是平台配置，卡在后端单次约 157 秒的硬上限之下。接口与 OpenAI 的 `audio/transcriptions` 兼容。',
    params: '1.7B 参数',
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
      '当前指向 CosyVoice3（Fun-CosyVoice3-0.5B-2512），支持 9 种语言，可将文本合成为自然语音，适用于播报、有声材料和数字人配音。基础合成与 OpenAI 的 `audio/speech` 兼容；**音色复刻要用平台扩展字段 `ref_audio` 和 `ref_text`**，标准 SDK 的参数表里没有这两个，需要自己拼请求体。',
    params: '0.5B 参数',
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
    summary: '文生视频、图生视频，异步返回结果。',
    detail:
      '当前指向 MiniMax-H3，根据文字描述生成视频，也支持由单张图片生成。**本平台默认**输出 4 秒、9:16、短边 768 的视频，模型本身支持 4～15 秒。生成耗时通常在几分钟，接口是异步任务形式：向 `/v1/videos` 提交后取回任务 ID，再轮询结果，**不要按同步请求设置超时**。任务进度可在「使用记录 → 任务」中查看。',
    params: '33B（H3-Omni-Transformer）',
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
      '将文本转换为向量，用于语义检索、相似度匹配和 RAG 知识库。一百多种语言共享同一向量空间，中文查询可以直接召回英文文档，输出 1024 维。**单次只处理前 2,048 token，超出的内容既不进模型也不报错**——实测在 2,048 token 之后接上一段完全无关的文字，返回的向量与不接时完全相同（余弦相似度 1.000），长文档必须自己先切分。换用别的向量模型会改变向量空间，已经建好的索引需要整体重算。',
    params: '约 568M 参数',
    size: '官方 FP32 权重约 2.3 GB',
    context: '2,048 tokens（实测：超出的内容不进模型，也不报错）',
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
    summary: '向量模型，单次可处理 4K token，默认输出 2,560 维。',
    detail:
      '将文本转换为向量，用于语义检索、相似度匹配和 RAG 知识库。默认输出 2,560 维，可以用 `dimensions` 参数裁剪到更低维度（实测传 256 生效）。**单次只处理前 4,096 token，超出的内容既不进模型也不报错**——实测在 4,096 token 之后接上无关文字，返回的向量几乎不变（余弦相似度 0.999），长文档必须自己先切分。换用别的向量模型会改变向量空间，已经建好的索引需要整体重算。',
    params: '4B 参数',
    size: '官方 BF16 权重约 8 GB',
    context: '4,096 tokens（实测：超出的内容不进模型，也不报错）',
    official: '32K tokens',
    io: '文本 → 2560 维向量',
  },
  {
    id: 'bge-reranker-v2-m3',
    name: 'BGE-Reranker-v2-M3',
    icon: 'BAAI',
    inputs: ['文本'],
    outputs: ['分数'],
    category: 'retrieval',
    endpoints: ['openai'],
    summary: '重排模型，按与问题的相关性给候选文档重新打分排序。',
    detail:
      '用在检索流程的最后一步：把已经取到的候选文档逐条与问题比对并重新打分，把最相关的排到前面。候选由谁召回不限——向量检索、关键词检索、数据库筛选都可以，它只负责排序，不参与召回。它不输出向量，只给出相关性分数，因此需要先有候选集才能使用。每个「问题 + 文档」对各自占用一个窗口，不是所有候选共享一份；单对超过 8,192 token **会直接返回错误**，不会静默截断，长文档建议先切分再重排。',
    params: '约 568M 参数',
    size: '官方 FP32 权重约 2.3 GB',
    context: '8,192 tokens（实测：超出直接报错，不静默截断）',
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
  // 暂时下架，不是永久删除：MODELS 里的条目原样留着，恢复只需删掉这一行
  'gemma4:26b',
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
