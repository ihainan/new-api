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

import React, { useEffect, useMemo, useState } from 'react';
import { Alibaba, BAAI, Gemma, Minimax, Qwen, Zhipu } from '@lobehub/icons';
import { API, copy, showError, showSuccess } from '../../helpers';
import BrandMark from './BrandMark';
import { Card, Empty, PageHead, Skeleton } from './shared';
import { CATEGORIES, ENDPOINT_LABELS, describe } from './modelCatalog';

/*
 * 模型页。回答的是「我能调什么、该挑哪个」，不是价目表——倍率和计费是管理视角。
 *
 * 可用性来自 /api/pricing（实时，跟着渠道开关走），介绍来自 modelCatalog.js
 * （手写，模型变更时同步更新）。两边分开的原因：网关没有存模型介绍的地方，
 * 但「哪些模型现在能用」又必须是实时的，写死会让停用的模型继续挂在页面上。
 */

const ICONS = { Zhipu, Qwen, Minimax, Gemma, BAAI, Alibaba };

// 只有这两类是按 token 吃上下文的
const TEXT_CATEGORIES = new Set(['chat', 'retrieval']);

function ModelIcon({ name, size = 26 }) {
  // 平台自己的服务（智能路由）用产品标记，不去外部图标库里凑一个。
  const Comp = name === 'brand' ? null : name ? ICONS[name] : null;
  // Color 变体更好认；BAAI 这类只有单色版的退回基础组件。
  const Rendered = Comp ? Comp.Color || Comp : null;
  if (name !== 'brand' && !Rendered) {
    return (
      <span
        className='pt-mdl-icon pt-mdl-icon-none'
        style={{ width: size, height: size }}
        aria-hidden='true'
      />
    );
  }
  /*
   * 图标库的 SVG 自带 <title>（Zhipu、Alibaba、BAAI…），鼠标悬停会弹出厂商名，
   * 而这个页面按要求不写厂商。aria-hidden 挡读屏，portal.css 里再把 title 关掉，
   * 两处都要管——删掉 vendor 字段挡不住图标自己带的标题。
   */
  return (
    <span
      className='pt-mdl-icon'
      style={{ width: size, height: size }}
      aria-hidden='true'
    >
      {name === 'brand' ? <BrandMark size={size} /> : <Rendered size={size} />}
    </span>
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

function SpecItem({ label, value }) {
  if (!value) return null;
  return (
    <div className='pt-spec'>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ModelRow({ m, open, onToggle }) {
  const endpoints = m.endpoints || [];
  const protocols = endpoints.map((e) => ENDPOINT_LABELS[e] || e).join(' / ');
  // 元信息挤在一行，用间隔点分开；空值直接不进数组，避免出现「· ·」。
  const meta = [
    m.params && !/未公布|而定/.test(m.params) ? m.params : null,
    m.context,
    m.io,
    protocols,
  ].filter(Boolean);
  const panelId = `mdl-${m.id.replace(/[^a-zA-Z0-9]/g, '-')}`;

  return (
    <div className={`pt-mdl${open ? ' open' : ''}`}>
      <div className='pt-mdl-head'>
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
          <ModelIcon name={m.icon} />
          <span className='pt-mdl-body'>
            <span className='pt-mdl-title'>
              <span className='pt-mdl-name'>{m.name}</span>
              <code className='pt-mdl-id'>{m.id}</code>
            </span>
            {m.summary ? <span className='pt-mdl-sum'>{m.summary}</span> : null}
            {meta.length ? (
              <span className='pt-mdl-meta'>{meta.join(' · ')}</span>
            ) : null}
          </span>
        </button>
        <div className='pt-mdl-act'>
          <button
            type='button'
            className='pt-btn sm'
            // 一页十几个同名按钮，读屏念出来全是「复制 ID」，得带上是谁的。
            aria-label={`复制模型 ID ${m.id}`}
            onClick={async () => {
              (await copy(m.id))
                ? showSuccess('已复制 ' + m.id)
                : showError('复制失败');
            }}
          >
            复制 ID
          </button>
          {/* 纯指示器，展开由整行的主按钮负责，不做成第二个可聚焦控件 */}
          <Chevron open={open} />
        </div>
      </div>

      {open ? (
        <div className='pt-mdl-detail' id={panelId}>
          {m.detail ? <p className='pt-mdl-text'>{m.detail}</p> : null}
          {m.note ? <p className='pt-mdl-note'>{m.note}</p> : null}
          <dl className='pt-specs'>
            <SpecItem label='参数规模' value={m.params} />
            <SpecItem label='部署方式' value={m.deployment} />
            {/* 上下文只对吃文本的模型有意义；出图、语音、视频那几个没有这个概念，
                给它们填「以上游部署为准」只是一行看不懂的噪音。
                文本模型里没测出来的才回退到那句话——比编一个数字诚实。 */}
            <SpecItem
              label='上下文长度'
              value={
                TEXT_CATEGORIES.has(m.category)
                  ? m.context || '以上游部署为准'
                  : m.context
              }
            />
            {/* 部署给到的和模型本身的规格不是一回事。一致就不必多说一遍，
                不一致才是使用者要知道的——他会以为自己有官方那么大的窗口。 */}
            <SpecItem
              label='模型官方规格'
              value={m.official && m.official !== m.context ? m.official : null}
            />
            <SpecItem label='单次输出上限' value={m.maxOutput} />
            <SpecItem label='输入 / 输出' value={m.io} />
            <SpecItem label='调用协议' value={protocols} />
            <SpecItem label='实际上游' value={m.upstream} />
            <SpecItem label='可用分组' value={(m.groups || []).join(' / ')} />
          </dl>
        </div>
      ) : null}
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
    seen.add(id);
    const d = describe(id);
    const eps = Array.isArray(p.supported_endpoint_types)
      ? p.supported_endpoint_types.filter((e) => typeof e === 'string' && e)
      : [];
    out.push({
      ...d,
      groups: Array.isArray(p.enable_groups)
        ? p.enable_groups.filter((g) => typeof g === 'string' && g)
        : [],
      // 接口给的协议列表是真值，目录里那份只是没接口时的备份。
      endpoints: eps.length ? eps : d.endpoints,
    });
  }
  return out;
}

export default function PortalModels() {
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
          showError(res.data?.message || '获取模型列表失败');
        }
      } catch (e) {
        if (!alive) return;
        setFailed(true);
        showError('获取模型列表失败');
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
          .filter((m) => m.category === c.key && (cat === 'all' || cat === c.key))
          .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999)),
      })).filter((g) => g.items.length),
    [matched, cat],
  );

  if (loading) {
    return (
      <div>
        <PageHead title='模型' />
        <Skeleton rows={4} />
      </div>
    );
  }

  // 接口挂了和「平台一个模型都没开」是两回事，之前都显示成后者。
  if (failed) {
    return (
      <div>
        <PageHead title='模型' />
        <Card>
          <div className='pt-empty'>
            <p style={{ margin: '0 0 12px' }}>没能取到模型列表。</p>
            <button
              type='button'
              className='pt-btn sm'
              onClick={() => setReloadKey((k) => k + 1)}
            >
              重新加载
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHead
        title='模型'
        sub='平台当前开放的模型。复制模型 ID 填进代码即可调用，无需单独申请。'
      />

      {available.length === 0 ? (
        <Card>
          <Empty text='暂无可用模型，请联系管理员' />
        </Card>
      ) : (
        <>
          <div className='pt-filters'>
            <input
              className='pt-input'
              style={{ minWidth: 220 }}
              type='search'
              placeholder='搜索模型名称或 ID'
              aria-label='搜索模型'
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
                全部 <span className='pt-chip-n'>{matched.length}</span>
              </button>
              {CATEGORIES.filter((c) => counts[c.key]).map((c) => (
                <button
                  key={c.key}
                  type='button'
                  className={`pt-chip${cat === c.key ? ' on' : ''}`}
                  aria-pressed={cat === c.key}
                  onClick={() => setCat(c.key)}
                >
                  {c.label} <span className='pt-chip-n'>{counts[c.key]}</span>
                </button>
              ))}
            </div>
          </div>

          {groups.length === 0 ? (
            <Card>
              <Empty text='没有匹配的模型' />
            </Card>
          ) : (
            groups.map((g) => (
              <section key={g.key} className='pt-mdl-group'>
                <h2 className='pt-mdl-group-title'>{g.label}</h2>
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
