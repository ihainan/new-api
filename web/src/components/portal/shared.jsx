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

import React from 'react';
import { copy, showError, showSuccess } from '../../helpers';

/*
 * 门户页面共用的小元件。刻意不使用 Semi Design 组件：那套视觉是给管理端用的，
 * 员工门户要和 ZGCAI-Coding-Plan 的 portal 看起来是同一个产品。
 */

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
      <div className={`pt-stat-value${unavailable ? ' pt-na' : ''}`}>{value}</div>
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
    <div className='pt-card' style={{ padding: 16 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className='pt-skel'
          style={{ width: `${[100, 70, 88, 55][i % 4]}%`, marginTop: i ? 12 : 0 }}
        />
      ))}
    </div>
  );
}

export function CodeBlock({ code }) {
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
            (await copy(code)) ? showSuccess('已复制') : showError('复制失败');
          }}
        >
          复制
        </button>
      </div>
    </div>
  );
}

export function Tabs({ items, value, onChange }) {
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
          {it.label}
        </button>
      ))}
    </div>
  );
}

// 大数字压缩成人能读的形式。Token 动辄上亿，原样铺出来没人看得懂。
export function fmtCompact(n) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(2) + ' 亿';
  if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(1) + ' 万';
  return v.toLocaleString('zh-CN');
}

export function fmtInt(n) {
  const v = Number(n || 0);
  return Number.isFinite(v) ? v.toLocaleString('zh-CN') : '—';
}

export function fmtTime(sec) {
  if (!sec) return '—';
  const d = new Date(Number(sec) * 1000);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('zh-CN', { hour12: false });
}
