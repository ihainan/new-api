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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [jump, setJump] = useState('');
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // 页数一多，点数字也到不了第 137 页——省略号跳过的那一段没有入口
  const go = (e) => {
    e.preventDefault();
    const n = Number(jump);
    if (Number.isInteger(n) && n >= 1 && n <= maxPage && n !== page) onPage(n);
    setJump('');
  };
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
          {maxPage > 5 ? (
            <form className='pt-pager-jump' onSubmit={go}>
              <label>
                {t('跳至')}
                <input
                  type='number'
                  min='1'
                  max={maxPage}
                  inputMode='numeric'
                  value={jump}
                  placeholder={String(page)}
                  onChange={(e) => setJump(e.target.value)}
                  onBlur={go}
                />
                {t('页')}
              </label>
            </form>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

/*
 * 时间范围筛选。四个常用档 + 自定义起止日期。
 *
 * 只有固定档的时候，「9 月 14 号那天出了什么事」是查不了的：近 7 天太宽、近 24 小时
 * 又够不着。自定义按**本地时区的整天**算（开始日 00:00:00 到结束日 23:59:59）——
 * 人说「9 月 14 日」指的是他自己那一天，不是 UTC 的那一天。
 */
export const RANGES = [
  { key: '24h', label: '近 24 小时', hours: 24 },
  // 「今天」不是固定时长，是从今天零点到此刻——排查「今天怎么回事」时最常用
  { key: 'today', label: '今天' },
  { key: '7d', label: '近 7 天', hours: 24 * 7 },
  { key: '30d', label: '近 30 天', hours: 24 * 30 },
  { key: 'all', label: '全部', hours: 0 },
  { key: 'custom', label: '自定义' },
];

const dayStr = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/*
 * 界面上的选择 → [起, 止] 两个秒级时间戳。null 表示「这头不设限」。
 * 概览要的是两个数（它自己拼查询串），日志和任务要的是查询串片段，
 * 所以算在一处、各取所需，免得两边对「今天」「自定义」的理解跑偏。
 */
export function rangeBounds({ range, from, to }) {
  const now = Math.floor(Date.now() / 1000);
  if (range === 'custom') {
    const a = from ? Math.floor(new Date(`${from}T00:00:00`).getTime() / 1000) : null;
    const b = to ? Math.floor(new Date(`${to}T23:59:59`).getTime() / 1000) : now;
    // 两头都填了却反着填，就按人的本意对调，不要给个空结果了事
    return a && b && a > b ? [b, a] : [a, b];
  }
  if (range === 'today') {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return [Math.floor(d.getTime() / 1000), now];
  }
  const hours = RANGES.find((r) => r.key === range)?.hours || 0;
  return hours ? [now - hours * 3600, now] : [null, null];
}

// 日志/任务接口要的是查询串片段
export function rangeParams(value) {
  const [s, e] = rangeBounds(value);
  const out = [];
  if (s) out.push('start_timestamp=' + s);
  if (e) out.push('end_timestamp=' + e);
  return out;
}

export function RangeFilter({ value, onChange }) {
  const t = usePortalT();
  const today = dayStr(new Date());
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <>
      {/* 六个档位做成一排按钮太占地方，和旁边的模型、密钥下拉也不是一个样子，
          统一成带标签的下拉框 */}
      <label className='pt-field'>
        <span className='pt-field-label'>{t('时间')}</span>
        <select
          className='pt-select'
          aria-label={t('时间范围')}
          value={value.range}
          onChange={(e) => {
            const key = e.target.value;
            // 切到自定义时先落在「今天」，而不是空着什么都查不出来
            set(
              key === 'custom' && !value.from && !value.to
                ? { range: key, from: today, to: today }
                : { range: key },
            );
          }}
        >
          {RANGES.map((r) => (
            <option key={r.key} value={r.key}>
              {t(r.label)}
            </option>
          ))}
        </select>
      </label>
      {value.range === 'custom' ? (
        <div className='pt-daterange'>
          {/*
           * 两头互相卡住：结束日不能早于开始日。光靠 min/max 不够——
           * 日期框还能直接打字，所以改动时再夹一次，把另一头顶过去。
           * 这比弹个「日期不合法」体面：人想表达的是「就看这一天」。
           */}
          <input
            type='date'
            className='pt-date'
            aria-label={t('开始日期')}
            max={value.to || today}
            value={value.from || ''}
            onChange={(e) => {
              const from = e.target.value;
              set(value.to && from > value.to ? { from, to: from } : { from });
            }}
          />
          <span className='pt-sub'>{t('至')}</span>
          <input
            type='date'
            className='pt-date'
            aria-label={t('结束日期')}
            min={value.from || undefined}
            max={today}
            value={value.to || ''}
            onChange={(e) => {
              const to = e.target.value;
              set(value.from && to < value.from ? { from: to, to } : { to });
            }}
          />
        </div>
      ) : null}
    </>
  );
}

/*
 * 描述里的两种标记：
 *   `xxx`   -> 行内代码。「`response_format`」混在正文里不换字体根本认不出
 *              那是要照抄的字符串。
 *   **xxx** -> 加粗。只留给「不看就会踩」的那一句：静默截断、看不到图片、
 *              额度不够正文会空——加粗是给信息用的，不是拿来点缀的。
 */
export function withMarks(text) {
  return String(text)
    .split(/(`[^`]+`|\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className='pt-inline-code'>
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        // 加粗里面还会有行内代码，要再解析一层，否则反引号会原样露出来
        return (
          <strong key={i} className='pt-em'>
            {withMarks(part.slice(2, -2))}
          </strong>
        );
      }
      return part;
    });
}

/*
 * 把筛选状态挂到地址栏上。
 *
 * 之前只有从密钥页带过来的 ?token= 是活的，其它筛选一改地址栏纹丝不动：
 * 刷新一下回到默认、把链接发给同事对方看到的是另一个东西、浏览器前进后退也不认。
 *
 * 约定：
 *   - defaults 必须是模块级常量（identity 要稳定），值的类型决定怎么解析；
 *   - 等于默认值的参数不写进地址栏，免得一个干净的页面挂一串 range=7d&p=1；
 *   - 用 replaceState 不用 pushState：筛选是在同一个页面上调参数，
 *     每调一次就往历史里塞一条，后退键就变成了「撤销上一次勾选」，很烦人；
 *   - 改任何筛选都把页码顶回第 1 页——停在第 9 页换筛选条件，多半是空的。
 */
export function useUrlState(defaults, pageKey = 'p') {
  const read = useCallback(() => {
    const q = new URLSearchParams(window.location.search);
    const out = {};
    for (const [k, def] of Object.entries(defaults)) {
      const raw = q.get(k);
      if (raw == null) out[k] = def;
      else if (typeof def === 'number') out[k] = Number(raw) || def;
      else if (typeof def === 'boolean') out[k] = raw === '1';
      else out[k] = raw;
    }
    return out;
  }, [defaults]);

  const [state, setState] = useState(read);

  // 后退／前进要能回到当时那套筛选
  useEffect(() => {
    const onPop = () => setState(read());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [read]);

  const patch = useCallback(
    (next) => {
      setState((prev) => {
        const merged = { ...prev, ...next };
        // 动的不是页码，就回到第 1 页
        if (pageKey in defaults && !(pageKey in next)) merged[pageKey] = defaults[pageKey];
        const q = new URLSearchParams(window.location.search);
        for (const [k, def] of Object.entries(defaults)) {
          const v = merged[k];
          const isDefault = typeof def === 'boolean' ? v === def : String(v) === String(def);
          if (isDefault || v === '' || v == null) q.delete(k);
          else q.set(k, typeof def === 'boolean' ? '1' : String(v));
        }
        const qs = q.toString();
        window.history.replaceState(
          {},
          '',
          window.location.pathname + (qs ? '?' + qs : ''),
        );
        return merged;
      });
    },
    [defaults, pageKey],
  );

  return [state, patch];
}
