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
