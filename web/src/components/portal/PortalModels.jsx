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
import {
  CATEGORIES,
  ENDPOINT_LABELS,
  describe,
} from './modelCatalog';

/*
 * 模型页。回答的是「我能调什么、该挑哪个」，不是价目表——倍率和计费是管理视角。
 *
 * 可用性来自 /api/pricing（实时，跟着渠道开关走），介绍来自 modelCatalog.js
 * （手写，模型变更时同步更新）。两边分开的原因：网关没有存模型介绍的地方，
 * 但「哪些模型现在能用」又必须是实时的，写死会让停用的模型继续挂在页面上。
 */

const ICONS = { Zhipu, Qwen, Minimax, Gemma, BAAI, Alibaba };

function ModelIcon({ name, size = 26 }) {
  // 平台自己的服务（智能路由）用产品标记，不去外部图标库里凑一个。
  if (name === 'brand') {
    return (
      <span className='pt-mdl-icon' style={{ width: size, height: size }}>
        <BrandMark size={size} />
      </span>
    );
  }
  const Comp = name ? ICONS[name] : null;
  // Color 变体更好认；BAAI 这类只有单色版的退回基础组件。
  const Rendered = Comp ? Comp.Color || Comp : null;
  if (Rendered) {
    return (
      <span className='pt-mdl-icon' style={{ width: size, height: size }}>
        <Rendered size={size} />
      </span>
    );
  }
  return <span className='pt-mdl-icon pt-mdl-icon-none' style={{ width: size, height: size }} />;
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

function CopyId({ id }) {
  return (
    <button
      type='button'
      className='pt-btn sm'
      onClick={async (e) => {
        e.stopPropagation();
        (await copy(id)) ? showSuccess('已复制 ' + id) : showError('复制失败');
      }}
    >
      复制 ID
    </button>
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
  // 元信息挤在一行，用间隔点分开；空值直接不进数组，避免出现「· ·」。
  const meta = [
    m.params && !/未公布|而定/.test(m.params) ? m.params : null,
    // 上下文是挑模型时最先要看的一条，不该藏在展开区里
    m.context,
    m.io,
    endpoints.map((e) => ENDPOINT_LABELS[e] || e).join(' / '),
  ].filter(Boolean);

  return (
    <div className={`pt-mdl${open ? ' open' : ''}`}>
      <div
        className='pt-mdl-head'
        role='button'
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <ModelIcon name={m.icon} />
        <div className='pt-mdl-body'>
          <div className='pt-mdl-title'>
            <span className='pt-mdl-name'>{m.name}</span>
            <code className='pt-mdl-id'>{m.id}</code>
          </div>
          <p className='pt-mdl-sum'>
            {m.unlisted ? '这个模型刚上线，介绍还没补上。' : m.summary}
          </p>
          {meta.length ? <p className='pt-mdl-meta'>{meta.join(' · ')}</p> : null}
        </div>
        <div className='pt-mdl-act'>
          <CopyId id={m.id} />
          <Chevron open={open} />
        </div>
      </div>

      {open ? (
        <div className='pt-mdl-detail'>
          {m.detail ? <p className='pt-mdl-text'>{m.detail}</p> : null}
          {m.note ? <p className='pt-mdl-note'>{m.note}</p> : null}
          <dl className='pt-specs'>
            <SpecItem label='参数规模' value={m.params} />
            {/* 自部署模型的上下文由上游启动参数决定，网关这边看不到真值，
                所以不填数字而是说明它取决于哪里——比编一个数字诚实。 */}
            <SpecItem label='上下文长度' value={m.context || '以上游部署为准'} />
            {/* 上游只对 max_tokens 设了硬上限时单独列出来：它决定一次能吐多少，
                和上下文不是一回事，混在一起看会写出超限的调用。 */}
            {/* 部署给到的和模型本身的规格不是一回事。一致就不必多说一遍，
                不一致才是使用者要知道的——他会以为自己有官方那么大的窗口。 */}
            <SpecItem
              label='模型官方规格'
              value={m.official && m.official !== m.context ? m.official : null}
            />
            <SpecItem label='单次输出上限' value={m.maxOutput} />
            <SpecItem label='输入 / 输出' value={m.io} />
            <SpecItem
              label='调用协议'
              value={endpoints.map((e) => ENDPOINT_LABELS[e] || e).join(' / ')}
            />
            <SpecItem label='实际上游' value={m.upstream} />
            <SpecItem label='可用分组' value={(m.groups || []).join(' / ')} />
          </dl>
        </div>
      ) : null}
    </div>
  );
}

export default function PortalModels() {
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState([]);
  const [kw, setKw] = useState('');
  const [cat, setCat] = useState('all');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await API.get('/api/pricing');
        if (res.data?.success) setAvailable(res.data.data || []);
        else showError(res.data?.message || '获取模型列表失败');
      } catch (e) {
        showError('获取模型列表失败');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 以接口返回的可用模型为准，逐个查目录补介绍。目录里有、但网关没开的模型
  // 不会出现在这里——页面绝不承诺调不通的东西。
  const all = useMemo(
    () =>
      available.map((p) => {
        const d = describe(p.model_name);
        return {
          ...d,
          groups: p.enable_groups || [],
          // 接口给的协议列表是真值，目录里那份只是没接口时的备份。
          endpoints: p.supported_endpoint_types?.length
            ? p.supported_endpoint_types
            : d.endpoints,
        };
      }),
    [available],
  );

  const counts = useMemo(() => {
    const c = {};
    for (const m of all) c[m.category] = (c[m.category] || 0) + 1;
    return c;
  }, [all]);

  const shown = useMemo(() => {
    const q = kw.trim().toLowerCase();
    return all.filter((m) => {
      if (cat !== 'all' && m.category !== cat) return false;
      if (!q) return true;
      return (
        m.id.toLowerCase().includes(q) ||
        (m.name || '').toLowerCase().includes(q) ||
        (m.summary || '').includes(q)
      );
    });
  }, [all, kw, cat]);

  const groups = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        ...c,
        items: shown
          .filter((m) => m.category === c.key)
          .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999)),
      })).filter((g) => g.items.length),
    [shown],
  );

  if (loading) {
    return (
      <div>
        <PageHead title='模型' />
        <Skeleton rows={4} />
      </div>
    );
  }

  return (
    <div>
      <PageHead
        title='模型'
        sub='平台当前开放的模型。复制模型 ID 填进代码即可调用，无需单独申请。'
      />

      {all.length === 0 ? (
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
              value={kw}
              onChange={(e) => setKw(e.target.value)}
            />
            <div className='pt-chips'>
              <button
                type='button'
                className={`pt-chip${cat === 'all' ? ' on' : ''}`}
                onClick={() => setCat('all')}
              >
                全部 <span className='pt-chip-n'>{all.length}</span>
              </button>
              {CATEGORIES.filter((c) => counts[c.key]).map((c) => (
                <button
                  key={c.key}
                  type='button'
                  className={`pt-chip${cat === c.key ? ' on' : ''}`}
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
