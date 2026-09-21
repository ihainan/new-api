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

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { copy, showError, showSuccess } from '../../helpers';

/*
 * 门户页面共用的小元件。刻意不使用 Semi Design 组件：那套视觉是给管理端用的，
 * 员工门户要和 ZGCAI-Coding-Plan 的 portal 看起来是同一个产品。
 */

/*
 * 面板只维护中英两套文案。浏览器是日语/法语时 i18next 会挑那边的旧译文，
 * 而新文案不再同步过去，界面就会变成中外混排——所以这里把语言收敛成两种：
 * 中文（含繁体）用中文，其余一律英文。管理端不受影响，它仍是全局那个 t。
 */
export function usePortalT() {
  const { t, i18n } = useTranslation();
  const zh = String(i18n.language || '').toLowerCase().startsWith('zh');
  return useMemo(
    () => (zh ? i18n.getFixedT('zh-CN') : i18n.getFixedT('en')),
    [zh, i18n, t],
  );
}

export function PageHead({ title, sub }) {
  return (
    <>
      <h1 className='pt-page-title'>{title}</h1>
      {sub ? <p className='pt-page-sub'>{sub}</p> : null}
    </>
  );
}

export function Stat({ label, value, hint, unavailable }) {
  return (
    <div className='pt-stat'>
      <div className='pt-stat-label'>{label}</div>
      <div className={`pt-stat-value${unavailable ? ' pt-na' : ''}`}>
        {value}
      </div>
      {hint ? <div className='pt-stat-hint'>{hint}</div> : null}
    </div>
  );
}

export function Card({ className = '', children }) {
  return <div className={`pt-card ${className}`}>{children}</div>;
}

export function Empty({ text }) {
  return <div className='pt-empty'>{text}</div>;
}

export function Skeleton({ rows = 4 }) {
  return (
    <div className='pt-card pt-skel-card'>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className='pt-skel'
          style={{
            width: `${[100, 70, 88, 55][i % 4]}%`,
            marginTop: i ? 12 : 0,
          }}
        />
      ))}
    </div>
  );
}

export function CodeBlock({ code }) {
  const t = usePortalT();
  return (
    <div className='pt-code-wrap' style={{ position: 'relative' }}>
      <pre className='pt-code'>
        <code>{code}</code>
      </pre>
      <div className='pt-code-copy'>
        <button
          type='button'
          className='pt-btn sm'
          onClick={async () => {
            (await copy(code))
              ? showSuccess(t('已复制'))
              : showError(t('复制失败'));
          }}
        >
          {t('复制')}
        </button>
      </div>
    </div>
  );
}

export function Tabs({ items, value, onChange }) {
  const t = usePortalT();
  return (
    <div className='pt-tabs' role='tablist'>
      {items.map((it) => (
        <button
          key={it.key}
          type='button'
          role='tab'
          aria-selected={value === it.key}
          className={`pt-tab${value === it.key ? ' active' : ''}`}
          onClick={() => onChange(it.key)}
        >
          {t(it.label)}
        </button>
      ))}
    </div>
  );
}

/*
 * 数字格式跟着「面板显示的语言」走：中文界面给「1.2 亿」，英文界面给 120M。
 * 取的是面板收敛后的语言而不是浏览器语言——日语浏览器看到的是英文界面，
 * 再按 ja 格式化就会冒出「3.3万」，和周围的英文对不上。
 */
function lang() {
  const cur = (typeof window !== 'undefined' && window.__i18n?.language) || 'zh-CN';
  return String(cur).toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}

// 大数字压缩成人能读的形式。Token 动辄上亿，原样铺出来没人看得懂。
export function fmtCompact(n) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return '—';
  if (Math.abs(v) < 1e4) return v.toLocaleString(lang());
  return new Intl.NumberFormat(lang(), {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(v);
}

export function fmtInt(n) {
  const v = Number(n || 0);
  return Number.isFinite(v) ? v.toLocaleString(lang()) : '—';
}

// 日志表里一屏几十行，年份对每一行都一样，纯属占地方。
// 跨年时用得上，所以只在不是今年时才补上年份。
export function fmtLogTime(sec) {
  if (!sec) return '—';
  const d = new Date(Number(sec) * 1000);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n) => String(n).padStart(2, '0');
  const md = `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  return d.getFullYear() === new Date().getFullYear()
    ? md
    : `${d.getFullYear()} ${md}`;
}

export function fmtTime(sec) {
  if (!sec) return '—';
  const d = new Date(Number(sec) * 1000);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString(lang(), { hour12: false });
}

/*
 * 表格页脚的分页器。
 *
 * 原来是「上一页 ｜ 第 1/1 页 · 共 2 条 ｜ 下一页」三块挤在正中间，只有一页时
 * 还摆着两个点不动的灰按钮——占着地方，什么也没告诉人。
 *
 * 现在左边回答「我在看哪几条」（第 21–40 条，共 978 条），右边是页码；
 * 只有一页时右边整个不出现，只留那句计数。
 *
 * 页码要能直接点：只有上一页/下一页的话，从第 1 页到第 20 页得点二十次。
 * 页数多时中间用省略号收起来，窄屏再收一圈（只留当前页左右各一个）——
 * 420px 上摆十个数字会挤成一团。
 */

// 首页、末页、当前页左右各 span 个，中间断开处放省略号
function pageList(page, max, span) {
  const keep = new Set([1, max]);
  for (let i = page - span; i <= page + span; i += 1) {
    if (i >= 1 && i <= max) keep.add(i);
  }
  const nums = [...keep].sort((a, b) => a - b);
  const out = [];
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1] > 1) out.push('gap' + n);
    out.push(n);
  });
  return out;
}
function Chevron({ back }) {
  return (
    <svg
      width='16'
      height='16'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <path d={back ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}

export function Pager({ page, maxPage, total, pageSize, onPage }) {
  const t = usePortalT();
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className='pt-pager'>
      <span className='pt-pager-count'>
        {t('第 {{from}}–{{to}} 条，共 {{total}} 条', {
          from: fmtInt(from),
          to: fmtInt(to),
          total: fmtInt(total),
        })}
      </span>
      {maxPage > 1 ? (
        <nav className='pt-pager-nav' aria-label={t('分页')}>
          <button
            type='button'
            className='pt-pager-btn'
            aria-label={t('上一页')}
            disabled={page <= 1}
            onClick={() => onPage(Math.max(1, page - 1))}
          >
            <Chevron back />
          </button>
          {pageList(page, maxPage, 2).map((it) =>
            typeof it === 'number' ? (
              <button
                key={it}
                type='button'
                // 离当前页两格的那圈，窄屏上收起来；首页和末页永远留着，
                // 否则从中间页没法一步跳回头或跳到底
                className={`pt-page${it === page ? ' on' : ''}${
                  Math.abs(it - page) > 1 && it !== 1 && it !== maxPage
                    ? ' far'
                    : ''
                }`}
                aria-label={t('第 {{page}} 页', { page: it })}
                aria-current={it === page ? 'page' : undefined}
                onClick={() => onPage(it)}
              >
                {it}
              </button>
            ) : (
              <span key={it} className='pt-page-gap' aria-hidden='true'>
                …
              </span>
            ),
          )}
          <button
            type='button'
            className='pt-pager-btn'
            aria-label={t('下一页')}
            disabled={page >= maxPage}
            onClick={() => onPage(page + 1)}
          >
            <Chevron />
          </button>
        </nav>
      ) : null}
    </div>
  );
}
