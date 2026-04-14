import React, { useEffect, useState, useMemo, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, Avatar, Button, Input, Spin, Empty, Tag, Typography } from '@douyinfe/semi-ui';
import { IconSearch, IconCopy } from '@douyinfe/semi-icons';
import { API, copy, showError, showSuccess } from '../../helpers';
import { UserContext } from '../../context/User';

const { Title, Text } = Typography;

// ── Provider 元数据 ────────────────────────────────────────────────────────────
const PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    color: '#10a37f',
    initial: 'O',
    patterns: [
      /^gpt-/i, /^o1/i, /^o3/i, /^o4/i,
      /^text-davinci/i, /^text-embedding/i, /^text-moderation/i,
      /^dall-e/i, /^tts-/i, /^whisper/i, /^chatgpt/i,
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    color: '#CC785C',
    initial: 'A',
    patterns: [/^claude/i],
  },
  {
    id: 'google',
    name: 'Google',
    color: '#4285F4',
    initial: 'G',
    patterns: [/^gemini/i, /^palm/i, /^bison/i, /^gecko/i, /^imagegeneration/i],
  },
  {
    id: 'meta',
    name: 'Meta',
    color: '#0081FB',
    initial: 'M',
    patterns: [/^llama/i, /^meta-/i, /^codellama/i],
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    color: '#FF7000',
    initial: 'M',
    patterns: [/^mistral/i, /^mixtral/i, /^codestral/i, /^mathstral/i, /^pixtral/i],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    color: '#4D6BFE',
    initial: 'D',
    patterns: [/^deepseek/i],
  },
  {
    id: 'qwen',
    name: '通义千问',
    color: '#FF6A00',
    initial: 'Q',
    patterns: [/^qwen/i, /^qwq/i, /^qvq/i],
  },
  {
    id: 'baidu',
    name: '文心一言',
    color: '#2932E1',
    initial: 'B',
    patterns: [/^ernie/i, /^wenxin/i, /^eb-/i],
  },
  {
    id: 'bytedance',
    name: '豆包',
    color: '#1664FF',
    initial: 'D',
    patterns: [/^doubao/i, /^ep-/i],
  },
  {
    id: 'moonshot',
    name: 'Moonshot（Kimi）',
    color: '#333333',
    initial: 'K',
    patterns: [/^moonshot/i, /^kimi/i],
  },
  {
    id: 'zhipu',
    name: '智谱 AI',
    color: '#1A73E8',
    initial: 'Z',
    patterns: [/^glm/i, /^chatglm/i],
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    color: '#7B68EE',
    initial: 'M',
    patterns: [/^abab/i, /^minimax/i],
  },
  {
    id: '01ai',
    name: '零一万物',
    color: '#E84040',
    initial: 'Y',
    patterns: [/^yi-/i],
  },
  {
    id: 'cohere',
    name: 'Cohere',
    color: '#39594D',
    initial: 'C',
    patterns: [/^command/i, /^embed-/i, /^rerank/i],
  },
  {
    id: 'tencent',
    name: '腾讯混元',
    color: '#07C160',
    initial: 'T',
    patterns: [/^hunyuan/i],
  },
  {
    id: 'iflytek',
    name: '讯飞星火',
    color: '#1E90FF',
    initial: 'S',
    patterns: [/^spark/i],
  },
  {
    id: 'stability',
    name: 'Stability AI',
    color: '#FF4785',
    initial: 'S',
    patterns: [/^stable-diffusion/i, /^sdxl/i, /^sd3/i],
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    color: '#20808D',
    initial: 'P',
    patterns: [/^sonar/i, /^pplx/i],
  },
  {
    id: 'stepfun',
    name: '阶跃星辰',
    color: '#6C63FF',
    initial: 'S',
    patterns: [/^step-/i],
  },
  {
    id: 'flux',
    name: 'Black Forest Labs',
    color: '#222222',
    initial: 'F',
    patterns: [/^flux/i],
  },
];

// ── 模型描述（可选）────────────────────────────────────────────────────────────
const MODEL_DESCRIPTIONS = {
  'gpt-4o': 'OpenAI 最新旗舰多模态模型，支持文本、图像、音频输入',
  'gpt-4o-mini': '轻量版 GPT-4o，高性价比，适合日常任务',
  'gpt-4-turbo': 'GPT-4 Turbo，支持 128K 上下文，性能强劲',
  'gpt-4': '具备强大理解与推理能力的旗舰语言模型',
  'gpt-3.5-turbo': '快速且经济的对话模型，适合大多数场景',
  'o1': 'OpenAI o1，擅长复杂推理与科学计算',
  'o1-mini': 'o1 的轻量版，推理能力强，速度更快',
  'o3-mini': 'OpenAI o3-mini，下一代推理模型',
  'claude-3-5-sonnet-20241022': 'Anthropic 最强性价比模型，代码与写作能力出色',
  'claude-3-5-haiku-20241022': '最快的 Claude 3.5 模型，适合高吞吐量场景',
  'claude-3-opus-20240229': 'Anthropic 旗舰模型，复杂任务首选',
  'gemini-1.5-pro': 'Google Gemini 1.5 Pro，支持超长上下文',
  'gemini-1.5-flash': 'Gemini 1.5 Flash，快速高效的多模态模型',
  'gemini-2.0-flash': 'Gemini 2.0 Flash，Google 最新高速模型',
  'deepseek-v3': 'DeepSeek V3，国产顶级开源大模型',
  'deepseek-r1': 'DeepSeek R1，强大的推理型大模型',
  'deepseek-chat': 'DeepSeek 通用对话模型',
  'qwen-turbo': '通义千问 Turbo，速度与性能的平衡之选',
  'qwen-plus': '通义千问 Plus，更强的理解与生成能力',
  'qwen-max': '通义千问旗舰模型，复杂任务首选',
  'moonshot-v1-8k': 'Kimi，支持 8K 上下文',
  'moonshot-v1-32k': 'Kimi，支持 32K 超长上下文',
  'moonshot-v1-128k': 'Kimi，支持 128K 超长文档处理',
  'glm-4': '智谱 GLM-4，国产优质大语言模型',
  'glm-4v': '智谱 GLM-4V，支持多模态视觉理解',
};

// ── 工具函数 ──────────────────────────────────────────────────────────────────
function getProvider(modelName) {
  for (const p of PROVIDERS) {
    if (p.patterns.some((re) => re.test(modelName))) return p;
  }
  return {
    id: 'unknown',
    name: '其他',
    color: '#888888',
    initial: (modelName[0] ?? '?').toUpperCase(),
  };
}

// ── 模型卡片 ──────────────────────────────────────────────────────────────────
function ModelCard({ model, provider, onCopy }) {
  const desc = MODEL_DESCRIPTIONS[model];
  return (
    <Card
      className='!rounded-2xl border border-gray-100 hover:border-gray-300 hover:shadow-md transition-all duration-200 cursor-default'
      bodyStyle={{ padding: '16px' }}
    >
      <div className='flex flex-col gap-2.5'>
        {/* 顶部：provider logo + 名称 + 复制 */}
        <div className='flex items-start gap-2.5'>
          <Avatar
            size='small'
            style={{ backgroundColor: provider.color, flexShrink: 0, marginTop: 1 }}
          >
            {provider.initial}
          </Avatar>
          <div className='flex-1 min-w-0 flex items-start justify-between gap-1'>
            <span
              className='font-mono text-sm font-semibold text-gray-900 break-all leading-snug select-text'
              title={model}
            >
              {model}
            </span>
            <button
              onClick={() => onCopy(model)}
              className='flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors'
              title='复制模型名称'
            >
              <IconCopy size='small' />
            </button>
          </div>
        </div>

        {/* Provider 名称 */}
        <span className='text-xs text-gray-400 pl-9'>{provider.name}</span>

        {/* 描述（可选） */}
        {desc && (
          <p className='text-xs text-gray-500 leading-relaxed line-clamp-2 pl-9'>{desc}</p>
        )}
      </div>
    </Card>
  );
}

// ── 主页面 ────────────────────────────────────────────────────────────────────
export default function ModelGallery() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [userState] = useContext(UserContext);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notLoggedIn, setNotLoggedIn] = useState(false);
  const [search, setSearch] = useState('');
  const [activeProvider, setActiveProvider] = useState('all');

  useEffect(() => {
    if (!userState?.user) {
      setNotLoggedIn(true);
      setLoading(false);
      return;
    }
    async function fetchModels() {
      setLoading(true);
      try {
        const res = await API.get('/api/user/models');
        if (res.data.success) {
          setModels([...(res.data.data || [])].sort());
        } else {
          showError(res.data.message || t('获取模型列表失败'));
        }
      } catch {
        showError(t('获取模型列表失败'));
      } finally {
        setLoading(false);
      }
    }
    fetchModels();
  }, [userState?.user]);

  const providerGroups = useMemo(() => {
    const map = new Map();
    for (const m of models) {
      const p = getProvider(m);
      if (!map.has(p.id)) map.set(p.id, { provider: p, models: [] });
      map.get(p.id).models.push(m);
    }
    return [...map.values()].sort((a, b) =>
      a.provider.name.localeCompare(b.provider.name),
    );
  }, [models]);

  const providerList = useMemo(
    () => providerGroups.map((g) => g.provider),
    [providerGroups],
  );

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return providerGroups
      .filter((g) => activeProvider === 'all' || g.provider.id === activeProvider)
      .map((g) => ({
        ...g,
        models: q ? g.models.filter((m) => m.toLowerCase().includes(q)) : g.models,
      }))
      .filter((g) => g.models.length > 0);
  }, [providerGroups, activeProvider, search]);

  const totalVisible = filteredGroups.reduce((s, g) => s + g.models.length, 0);

  async function handleCopy(modelName) {
    if (await copy(modelName)) {
      showSuccess(t('已复制：') + modelName);
    }
  }

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* ── 页面头部横幅 ── */}
      <div className='bg-white border-b border-gray-100'>
        <div className='max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-10'>
          <h1 className='text-3xl font-bold text-gray-900 tracking-tight'>
            {t('可用模型')}
          </h1>
          <p className='mt-2 text-base text-gray-500'>
            {loading
              ? t('加载中...')
              : notLoggedIn
              ? t('登录后查看您所在分组的可用模型')
              : t('共 {{count}} 个模型，按 Provider 分组展示', { count: models.length })}
          </p>
        </div>
      </div>

      {/* ── 主内容区 ── */}
      <div className='max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-8'>

        {/* 未登录提示 */}
        {notLoggedIn ? (
          <div className='flex flex-col items-center justify-center py-24 gap-4'>
            <Empty description={t('请先登录以查看可用模型')} />
            <Button type='primary' onClick={() => navigate('/login')}>
              {t('前往登录')}
            </Button>
          </div>
        ) : (
          <>
            {/* 搜索 + Provider 筛选 */}
            <div className='mb-8 space-y-4'>
              <Input
                prefix={<IconSearch />}
                placeholder={t('搜索模型名称...')}
                value={search}
                onChange={setSearch}
                className='w-full sm:w-80'
                size='large'
                showClear
              />
              {!loading && providerList.length > 0 && (
                <div className='flex flex-wrap gap-2'>
                  <Tag
                    size='large'
                    color={activeProvider === 'all' ? 'blue' : 'grey'}
                    className='cursor-pointer select-none !rounded-full'
                    onClick={() => setActiveProvider('all')}
                  >
                    {t('全部')}（{models.length}）
                  </Tag>
                  {providerList.map((p) => {
                    const count =
                      providerGroups.find((g) => g.provider.id === p.id)?.models.length ?? 0;
                    return (
                      <Tag
                        key={p.id}
                        size='large'
                        color={activeProvider === p.id ? 'blue' : 'grey'}
                        className='cursor-pointer select-none !rounded-full'
                        onClick={() => setActiveProvider(p.id)}
                      >
                        {p.name}（{count}）
                      </Tag>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 内容 */}
            <Spin spinning={loading}>
              {!loading && totalVisible === 0 ? (
                <Empty description={t('暂无可用模型')} className='py-20' />
              ) : (
                <div className='space-y-10'>
                  {filteredGroups.map(({ provider, models: groupModels }) => (
                    <section key={provider.id}>
                      {/* Provider 标题栏 */}
                      <div className='flex items-center gap-2.5 mb-4'>
                        <Avatar
                          size='small'
                          style={{ backgroundColor: provider.color, flexShrink: 0 }}
                        >
                          {provider.initial}
                        </Avatar>
                        <span className='font-semibold text-gray-800'>{provider.name}</span>
                        <span className='text-sm text-gray-400'>
                          {groupModels.length} {t('个模型')}
                        </span>
                        <div className='flex-1 h-px bg-gray-100 ml-1' />
                      </div>

                      {/* 卡片网格 */}
                      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3'>
                        {groupModels.map((model) => (
                          <ModelCard
                            key={model}
                            model={model}
                            provider={provider}
                            onCopy={handleCopy}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </Spin>
          </>
        )}
      </div>
    </div>
  );
}
