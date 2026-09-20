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

import { useTranslation } from 'react-i18next';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { API, copy, showError, showSuccess } from '../../helpers';
import ModelIcon from './ModelIcon';
import { Card, Empty, PageHead, Skeleton } from './shared';
import { CATEGORIES, ENDPOINT_LABELS, HIDDEN, describe } from './modelCatalog';

/*
 * 模型页。回答的是「我能调什么、该挑哪个」，不是价目表——倍率和计费是管理视角。
 *
 * 可用性来自 /api/pricing（实时，跟着渠道开关走），介绍来自 modelCatalog.js
 * （手写，模型变更时同步更新）。两边分开的原因：网关没有存模型介绍的地方，
 * 但「哪些模型现在能用」又必须是实时的，写死会让停用的模型继续挂在页面上。
 */

// 只有这两类是按 token 吃上下文的
const TEXT_CATEGORIES = new Set(['chat', 'retrieval']);

/*
 * 分类图标。作用是让人一眼认出滚到了哪一段——十几个模型分五类，
 * 光靠一行小标题不够显眼。
 * 颜色按分类给，是为了区分段落，不是为了好看：同一个色只对应同一类。
 * 图标本身用线性描边，和侧栏导航那套保持一致。
 */
const CATEGORY_ICONS = {
  chat: <path d='M20 15a2 2 0 01-2 2H8l-4 3V6a2 2 0 012-2h12a2 2 0 012 2z' />,
  image: (
    <>
      <rect x='3' y='4' width='18' height='16' rx='2' />
      <circle cx='8.5' cy='9.5' r='1.5' />
      <path d='M21 16l-5-5-6 6' />
    </>
  ),
  audio: (
    <>
      <path d='M12 3v18' />
      <path d='M8 7v10' />
      <path d='M16 7v10' />
      <path d='M4 10v4' />
      <path d='M20 10v4' />
    </>
  ),
  video: (
    <>
      <rect x='2' y='5' width='14' height='14' rx='2' />
      <path d='M22 8l-6 4 6 4z' />
    </>
  ),
  retrieval: (
    <>
      <path d='M12 3l9 5-9 5-9-5z' />
      <path d='M3 13l9 5 9-5' />
    </>
  ),
  other: (
    <>
      <circle cx='5' cy='12' r='1.6' />
      <circle cx='12' cy='12' r='1.6' />
      <circle cx='19' cy='12' r='1.6' />
    </>
  ),
};

function CategoryIcon({ category }) {
  const path = CATEGORY_ICONS[category];
  if (!path) return null;
  return (
    <svg
      className={`pt-cat-icon cat-${category}`}
      width='18'
      height='18'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.7'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      {path}
    </svg>
  );
}

function Chevron({ open }) {
  return (
    <svg
      className={`pt-chev${open ? ' open' : ''}`}
      width='14'
      height='14'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <path d='M6 9l6 6 6-6' />
    </svg>
  );
}

/*
 * 能力矩阵。四态，缺一不可：
 *   true    实测通过
 *   false   实测不支持
 *   'error' 试了，但调用直接失败（比如上游 500）——从使用者角度是用不了，
 *           但原因在部署不在模型，和「模型没这个能力」是两回事
 *   'na'    该协议压根没有这个参数（如 Anthropic 没有 response_format）。
 *           画成 ✗ 是冤枉模型：换个入口同一个模型就有
 *   缺失     没验证过
 * 把没验证过的画成不支持，和编一个规格是同一类谎话。
 * 措辞用「未验证」不用「未测」：后者容易被读成「测了没测出来」。
 */
const CAPS = [
  ['stream', '流式输出', <path d='M4 7h16M4 12h11M4 17h7' />],
  [
    'tools',
    '函数调用',
    <>
      <path d='M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h2' />
      <path d='M16 4h2a2 2 0 012 2v12a2 2 0 01-2 2h-2' />
    </>,
  ],
  [
    'json',
    'JSON 模式',
    <>
      <path d='M9 4H7a2 2 0 00-2 2v4l-2 2 2 2v4a2 2 0 002 2h2' />
      <path d='M15 4h2a2 2 0 012 2v4l2 2-2 2v4a2 2 0 01-2 2h-2' />
    </>,
  ],
  [
    'vision',
    '图像输入',
    <>
      <rect x='3' y='5' width='18' height='14' rx='2' />
      <circle cx='8.5' cy='10' r='1.5' />
      <path d='M21 16l-5-5-6 6' />
    </>,
  ],
  [
    'reasoning',
    '深度思考',
    <>
      <path d='M9 18h6' />
      <path d='M10 21h4' />
      <path d='M12 3a6 6 0 00-3.5 10.9V16h7v-2.1A6 6 0 0012 3z' />
    </>,
  ],
  [
    'cache',
    '提示缓存',
    <>
      <path d='M20 11a8 8 0 10-2.3 5.7' />
      <path d='M20 5v6h-6' />
    </>,
  ],
];

/* 能力释义。名字本身不够自解释——「提示缓存」「深度思考」不说明白，
   看的人只能猜。一句话说清「有了它你能干什么」，必要时带上字段名。 */
const CAP_HELP = {
  stream: '边生成边往回吐，不用等整段写完。请求里传 stream: true。',
  tools:
    '你把可调用的函数描述给它，它决定什么时候调、参数填什么，由你的代码去执行。',
  json: '可以要求它只输出 JSON，不掺解释文字，用 response_format 约束。',
  vision: '消息里可以带图片，让它看图回答。',
  reasoning: '作答前先推理，返回里能拿到思考过程。',
  cache: '重复的前缀（长系统提示、同一份文档）会命中缓存，第二次起更快也更省。',
};

function Cap({ cap, state, tag }) {
  const { t } = useTranslation();
  const { open, setOpen, ref } = useTip();
  const [key, label, path] = cap;
  return (
    <button
      ref={ref}
      type='button'
      className={`pt-cap ${state}${open ? ' open' : ''}`}
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
      onBlur={() => setOpen(false)}
    >
      {/* 状态符号。光靠颜色深浅和删除线，支持和不支持隔一米就分不出来了；
          ✓ / ✕ 是不依赖颜色也能读的那一层。 */}
      <b className='pt-cap-mark' aria-hidden='true'>
        {state === 'on'
          ? '✓'
          : state === 'unknown' || state === 'na'
            ? '–'
            : '✕'}
      </b>
      <svg
        width='16'
        height='16'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.7'
        strokeLinecap='round'
        strokeLinejoin='round'
        aria-hidden='true'
      >
        {path}
      </svg>
      <span>{t(label)}</span>
      {tag ? <em className='pt-cap-tag'>{t(tag)}</em> : null}
      {CAP_HELP[key] ? (
        <span className='pt-tip wide' role='tooltip'>
          {t(CAP_HELP[key])}
        </span>
      ) : null}
    </button>
  );
}

function CapGrid({ caps }) {
  return (
    <div className='pt-caps'>
      {CAPS.map(([key, label, path]) => {
        const v = caps ? caps[key] : undefined;
        const state =
          v === true
            ? 'on'
            : v === 'error'
              ? 'err'
              : v === 'na'
                ? 'na'
                : v === false
                  ? 'off'
                  : 'unknown';
        const tag =
          state === 'unknown'
            ? '未验证'
            : state === 'err'
              ? '调用失败'
              : state === 'na'
                ? '无此参数'
                : null;
        return (
          <Cap key={key} cap={[key, label, path]} state={state} tag={tag} />
        );
      })}
    </div>
  );
}

/*
 * 规格单元。值里结尾的括号是限定语（「建议单次请求不超过」「实测：超出部分被
 * 丢弃」），拆到第二行用弱化字号显示：挤在一起会从括号中间断行，数字反而看不清。
 * 限定语本身不能删——它区分的是「实测值」「平台配置值」和「建议值」。
 */

/*
 * 大数字缩写：1,000,000 → 1M、262,144 → 256K。
 * 一行五个指标，写全了光数字就占掉一半宽度，而挑模型时要的是量级不是精确值。
 * 完整数字放进 title，鼠标停一下就能看到——省地方不等于把信息藏掉。
 *
 * 优先按 1024 的倍数缩（模型上下文基本都是 2 的幂，262,144 写成 256K 才是
 * 大家认的写法），不是整倍数再退回十进制。
 */
function abbrNumber(n) {
  if (!Number.isFinite(n) || n < 1000) return null;
  for (const [unit, base] of [
    ['M', 1048576],
    ['K', 1024],
  ]) {
    if (n % base === 0) return n / base + unit;
  }
  for (const [unit, base] of [
    ['M', 1000000],
    ['K', 1000],
  ]) {
    if (n % base === 0) return n / base + unit;
  }
  return null;
}

// 值里第一个带千分位的数字换成缩写，其余原样留着（单位、括号里的限定语）
/*
 * 去掉末尾括号里的限定语（「（建议单次请求不超过）」这类）。中英文括号都要认：
 * 只认全角的话，英文译文里的半角括号会原样留在折叠行里，把那一格顶破。
 */
function stripQualifier(text) {
  return typeof text === 'string'
    ? text.replace(/\s*[（(][^（(]*[)）]\s*$/, '')
    : text;
}

function abbrValue(text) {
  if (typeof text !== 'string') return { text, full: null };
  const m = /(\d[\d,]*)/.exec(text);
  if (!m) return { text, full: null };
  const short = abbrNumber(Number(m[1].replace(/,/g, '')));
  if (!short) return { text, full: null };
  return { text: text.replace(m[1], short), full: text };
}

/*
 * 点开的气泡要有正常的关法：点别处、按 Esc、翻页都得收起来，同一时间只开一个。
 * pointerdown 而不是 click：点到别的按钮时要先收起来，别跟那次点击抢。
 * 指标值和能力项共用这一套。
 */
function useTip() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const esc = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        ref.current?.focus();
      }
    };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', () => setOpen(false), {
      once: true,
      passive: true,
    });
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return { open, setOpen, ref };
}

function Metric({ label, value, abbr }) {
  const { open, setOpen, ref } = useTip();

  if (!value) return null;
  const shown = abbr ? abbrValue(value) : { text: value, full: null };
  return (
    <div className='pt-metric'>
      {/* 标签在上、值在下：横排时两者只差几像素，对比撑不起「配对」这件事。
          不再放小图标——它挂在标签左边、突出于这一列之外，一排下来左边缘
          是锯齿状，而标签本身已经是「上下文」「输入」这些字。 */}
      <span className='pt-metric-label'>{label}</span>
      {shown.full ? (
        /*
         * 缩写过的值做成真按钮。之前只有 cursor:help 加原生 title：
         * 鼠标指针摆出「有东西可看」的样子，点下去却没反应；
         * 触屏没有悬停，完整数值等于看不到；键盘也够不着。
         * 现在悬停、聚焦、点击都能展开，触屏和键盘都走得通。
         */
        <button
          ref={ref}
          type='button'
          className={`pt-metric-value has-full${open ? ' open' : ''}`}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          onBlur={() => setOpen(false)}
        >
          {/* 文字单独一层来截断：按钮本身必须 overflow:visible，否则气泡被剪掉 */}
          <span className='pt-metric-text'>{shown.text}</span>
          <span className='pt-tip' role='tooltip'>
            {shown.full}
          </span>
        </button>
      ) : (
        <span className='pt-metric-value'>{shown.text}</span>
      )}
    </div>
  );
}

function SpecItem({ label, value, wide }) {
  if (!value) return null;
  return (
    <div className={`pt-spec${wide ? ' wide' : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ModelRow({ m, open, onToggle }) {
  const { t } = useTranslation();
  const endpoints = m.endpoints || [];
  const protocols = endpoints
    .map((e) => t(ENDPOINT_LABELS[e] || e))
    .join(' / ');
  // 元信息挤在一行，用间隔点分开；空值直接不进数组，避免出现「· ·」。
  // 输入和输出各占一格。写成「文本 → 文本」是把两件事塞进一格，
  // 纵向也对不齐——箭头左右的内容长度不一样，列就错位了。
  const inputs = (m.inputs || []).map(t).join(t('、')) || null;
  const outputs = (m.outputs || []).map(t).join(t('、')) || null;
  // 折叠行里上下文只留数字，括号里的限定语放到展开后的规格里说，
  // 否则一行挤三样东西，最该看的数字反而不显眼。
  const contextBrief = m.context ? stripQualifier(t(m.context)) : null;
  const panelId = `mdl-${m.id.replace(/[^a-zA-Z0-9]/g, '-')}`;

  return (
    <div className={`pt-mdl${open ? ' open' : ''}`}>
      <div className={`pt-mdl-head${m.detail || m.summary ? ' has-desc' : ''}`}>
        {/*
         * 展开控件和复制按钮必须是同级的真 <button>。之前把复制按钮嵌在
         * role="button" 的行里，键盘 Tab 到它再按回车，keydown 冒泡到父行被
         * preventDefault 掉，结果是展开而不是复制。
         */}
        <button
          type='button'
          className='pt-mdl-main'
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <ModelIcon icon={m.icon} size={28} />
          <span className='pt-mdl-title'>
            <span className='pt-mdl-name'>{t(m.name)}</span>
            <code className='pt-mdl-id'>{m.id}</code>
          </span>
        </button>
        <div className='pt-mdl-act'>
          <button
            type='button'
            className='pt-btn sm'
            // 一页十几个同名按钮，读屏念出来全是「复制 ID」，得带上是谁的。
            aria-label={t('复制模型 ID {{id}}', { id: m.id })}
            onClick={async () => {
              (await copy(m.id))
                ? showSuccess(t('已复制 {{id}}', { id: m.id }))
                : showError(t('复制失败'));
            }}
          >
            {t('复制 ID')}
          </button>
          {/*
           * 箭头长得像按钮，就得真能点。但它和标题行是同一个动作，
           * 所以不进 Tab 顺序、也不报给读屏——键盘和读屏走标题行那一个控件，
           * 鼠标点哪个都行。
           */}
          <button
            type='button'
            className='pt-mdl-chev'
            tabIndex={-1}
            aria-hidden='true'
            onClick={onToggle}
          >
            <Chevron open={open} />
          </button>
        </div>
      </div>

      {/*
       * 描述必须长在按钮外面：浏览器不让人选中 <button> 里的文字，
       * 放进去就复制不了。代价是点描述不再展开，点标题行或箭头才行。
       *
       * 折叠时直接给详述的前两行，不再另外摆一句摘要——两者开头说的是
       * 同一件事，并排放着就是同一句话写两遍。summary 字段保留，搜索还在用。
       */}
      {m.detail ? (
        <p className={`pt-mdl-desc ${open ? 'pt-mdl-full' : 'pt-mdl-brief'}`}>
          {t(m.detail)}
        </p>
      ) : m.summary ? (
        <p className='pt-mdl-desc pt-mdl-sum'>{t(m.summary)}</p>
      ) : null}

      {/* 指标条放在卡片层级，不在那个可点击的主按钮里面：
          它是整行的数据带，不该被按钮的宽度截断（右边停在「复制 ID」之前），
          也本来就不该算进切换按钮的可读名称。 */}
      <div className='pt-metrics'>
        <Metric
          abbr
          label={t('上下文')}
          value={
            TEXT_CATEGORIES.has(m.category)
              ? contextBrief || t('以上游部署为准')
              : contextBrief
          }
        />
        <Metric
          abbr
          label={t('单次输出')}
          value={m.maxOutput && stripQualifier(t(m.maxOutput))}
        />
        <Metric label={t('输入')} value={inputs} />
        <Metric label={t('输出')} value={outputs} />
        <Metric label={t('协议')} value={protocols} />
      </div>

      {/*
       * 详情区常驻 DOM，靠 grid-template-rows 0fr→1fr 做高度过渡；
       * 条件渲染没法过渡，height:auto 也不能插值。收起时用 inert 把里面的
       * 控件移出 Tab 顺序和读屏，视觉之外的行为和「不存在」一致。
       */}
      <div
        className={`pt-mdl-panel${open ? ' open' : ''}`}
        id={panelId}
        aria-hidden={open ? undefined : 'true'}
        inert={open ? undefined : ''}
      >
        {/* 裁切层不带内边距：内边距会算进 grid 行的最小高度，收起时收不干净 */}
        <div className='pt-mdl-panel-in'>
          <div className='pt-mdl-detail'>
            {/* 版本会跟着上游升级，所以标题不写版本号，靠这一行说明当前指向谁。
              加粗是因为它是这一条里最容易过期、也最该被看到的信息。 */}
            {m.highlight ? (
              <p className='pt-mdl-highlight'>{t(m.highlight)}</p>
            ) : null}
            {m.note ? <p className='pt-mdl-note'>{t(m.note)}</p> : null}
            {/* 只有对话模型才谈这些能力；出图、语音、向量模型套不上这套维度 */}
            {m.category === 'chat' ? (
              <div className='pt-caps-wrap'>
                <div className='pt-caps-label'>{t('能力')}</div>
                <CapGrid caps={m.caps} />
              </div>
            ) : null}

            {/* 次要信息：部署细节和出处。想深究的人才会看到这里，
              所以字号更小、颜色更弱，不跟上面的关键规格抢注意力。 */}
            <dl className='pt-specs pt-specs-more'>
              <SpecItem label={t('参数规模')} value={m.params && t(m.params)} />
              <SpecItem label={t('权重大小')} value={m.size && t(m.size)} />
              <SpecItem
                label={t('模型官方规格')}
                value={
                  m.official && m.official !== m.context ? t(m.official) : null
                }
              />
              {/* 实测到什么程度，单独占一整行：它是一句话，塞进窄格里会断得很碎 */}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

/*
 * /api/pricing 的每一行都当不可信输入处理：坏掉的一条不该把整页带崩。
 * 这些解析跑在渲染期，请求外面那个 try/catch 接不住。
 */
function normalize(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const id = typeof p.model_name === 'string' ? p.model_name.trim() : '';
    if (!id || seen.has(id)) continue;
    // 待下线的模型不往页面上放，哪怕网关还开着
    if (HIDDEN.has(id)) continue;
    seen.add(id);
    const d = describe(id);
    const eps = Array.isArray(p.supported_endpoint_types)
      ? p.supported_endpoint_types.filter((e) => typeof e === 'string' && e)
      : [];
    out.push({
      ...d,
      // 接口给的协议列表是真值，目录里那份只是没接口时的备份。
      endpoints: eps.length ? eps : d.endpoints,
    });
  }
  return out;
}

export default function PortalModels() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [available, setAvailable] = useState([]);
  const [kw, setKw] = useState('');
  const [cat, setCat] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await API.get('/api/pricing');
        if (!alive) return;
        if (res.data?.success) {
          setAvailable(normalize(res.data.data));
          setFailed(false);
        } else {
          setFailed(true);
          showError(res.data?.message || t('获取模型列表失败'));
        }
      } catch (e) {
        if (!alive) return;
        setFailed(true);
        showError(t('获取模型列表失败'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  // 先按搜索词过滤，分类计数再从结果里数。反过来会出现
  // 「图像生成 1」但点进去是空的。
  const matched = useMemo(() => {
    const q = kw.trim().toLowerCase();
    if (!q) return available;
    return available.filter((m) =>
      [m.id, m.name, m.summary]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [available, kw]);

  const counts = useMemo(() => {
    const c = {};
    for (const m of matched) c[m.category] = (c[m.category] || 0) + 1;
    return c;
  }, [matched]);

  const groups = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        ...c,
        items: matched
          .filter(
            (m) => m.category === c.key && (cat === 'all' || cat === c.key),
          )
          .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999)),
      })).filter((g) => g.items.length),
    [matched, cat],
  );

  if (loading) {
    return (
      <div>
        <PageHead title={t('模型')} />
        <Skeleton rows={4} />
      </div>
    );
  }

  // 接口挂了和「平台一个模型都没开」是两回事，之前都显示成后者。
  if (failed) {
    return (
      <div>
        <PageHead title={t('模型')} />
        <Card>
          <div className='pt-empty'>
            <p style={{ margin: '0 0 12px' }}>{t('没能取到模型列表。')}</p>
            <button
              type='button'
              className='pt-btn sm'
              onClick={() => setReloadKey((k) => k + 1)}
            >
              {t('重新加载')}
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHead
        title={t('模型')}
        sub={t(
          '平台当前开放的模型。复制模型 ID 填进代码即可调用，无需单独申请。',
        )}
      />

      {available.length === 0 ? (
        <Card>
          <Empty text={t('暂无可用模型，请联系管理员')} />
        </Card>
      ) : (
        <>
          <div className='pt-filters'>
            <input
              className='pt-input'
              style={{ minWidth: 220 }}
              type='search'
              placeholder={t('搜索模型名称或 ID')}
              aria-label={t('搜索模型')}
              value={kw}
              onChange={(e) => setKw(e.target.value)}
            />
            <div className='pt-chips'>
              <button
                type='button'
                className={`pt-chip${cat === 'all' ? ' on' : ''}`}
                aria-pressed={cat === 'all'}
                onClick={() => setCat('all')}
              >
                {t('全部')} <span className='pt-chip-n'>{matched.length}</span>
              </button>
              {CATEGORIES.filter((c) => counts[c.key]).map((c) => (
                <button
                  key={c.key}
                  type='button'
                  className={`pt-chip${cat === c.key ? ' on' : ''}`}
                  aria-pressed={cat === c.key}
                  onClick={() => setCat(c.key)}
                >
                  {t(c.label)}{' '}
                  <span className='pt-chip-n'>{counts[c.key]}</span>
                </button>
              ))}
            </div>
          </div>

          {groups.length === 0 ? (
            <Card>
              <Empty text={t('没有匹配的模型')} />
            </Card>
          ) : (
            groups.map((g) => (
              <section key={g.key} className='pt-mdl-group'>
                <h2 className='pt-mdl-group-title'>
                  <CategoryIcon category={g.key} />
                  {t(g.label)}
                </h2>
                <div className='pt-mdl-list'>
                  {g.items.map((m) => (
                    <ModelRow
                      key={m.id}
                      m={m}
                      open={openId === m.id}
                      onToggle={() => setOpenId(openId === m.id ? null : m.id)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}
