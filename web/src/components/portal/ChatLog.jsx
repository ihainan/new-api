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

import React, { useState } from 'react';
import ModelIcon from './ModelIcon';
import { fmtInt, fmtLogTime } from './shared';

/*
 * 对话日志的表格与窄屏卡片。
 *
 * 之前这张表只有时间/模型/结果/输入/输出/耗时六列，而日志行里其实还躺着
 * 首字延迟、缓存命中、入站路径、客户端 IP、是否流式、以及被映射到的真实上游模型
 * ——这些都是排查「为什么慢」「为什么贵」「到底调到了谁」时最要紧的信息。
 * 全在 other 那段 JSON 里，白白存着没给人看。
 */

// other 是一段 JSON 字符串，坏掉的一行不该把整页带崩
function parseOther(row) {
  let o = row.other;
  if (typeof o === 'string') {
    try {
      o = JSON.parse(o);
    } catch {
      o = null;
    }
  }
  return o && typeof o === 'object' ? o : {};
}

export function chatOutcome(row) {
  if (row.type === 5) return { cls: 'bad', text: '失败' };
  const end = parseOther(row).stream_status?.end_reason;
  // 客户端自己断开的不算服务端失败，但也不是干净的成功——分开标，
  // 否则用户会以为是网关把请求掐了
  if (end === 'client_gone') return { cls: 'warn', text: '客户端断开' };
  return { cls: 'ok', text: '成功' };
}

// 非流式请求的首字延迟存的是 -1000 这个哨兵值，不是真的负延迟
function firstToken(o, isStream) {
  const frt = Number(o.frt);
  if (!isStream || !Number.isFinite(frt) || frt <= 0) return null;
  return frt;
}

function ms(v) {
  if (v == null) return '—';
  return v >= 1000 ? (v / 1000).toFixed(1) + 's' : Math.round(v) + 'ms';
}

// 耗时分档，让慢的一眼能挑出来。阈值按对话请求的经验取。
function latencyClass(sec) {
  if (!sec && sec !== 0) return 'na';
  if (sec <= 5) return 'fast';
  if (sec <= 20) return 'mid';
  return 'slow';
}

function Cells({ r }) {
  const o = parseOther(r);
  const out = chatOutcome(r);
  const upstream = o.is_model_mapped ? o.upstream_model_name : null;
  const frt = firstToken(o, r.is_stream);
  const cache = Number(o.cache_tokens || 0);
  return { o, out, upstream, frt, cache };
}

export function ChatTable({ rows, openId, onToggleErr }) {
  return (
    <table className='pt-table pt-log-table'>
      <thead>
        <tr>
          <th>模型</th>
          <th>端点</th>
          <th>IP</th>
          <th>类型</th>
          <th className='pt-num'>Token</th>
          <th>延迟</th>
          <th>结果</th>
          <th>时间</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const { o, out, upstream, frt, cache } = Cells({ r });
          const failed = r.type === 5 && r.content;
          return (
            <React.Fragment key={r.id}>
              <tr>
                <td>
                  <div className='pt-cell-row'>
                    <ModelIcon model={r.model_name} size={16} />
                    <div className='pt-stack'>
                      <span className='pt-mono'>{r.model_name || '—'}</span>
                      {/* 上游把请求映射到了别的模型：不显示的话，日志里的名字
                          会和实际跑的模型对不上 */}
                      {upstream ? (
                        <span className='pt-sub pt-mono'>└ {upstream}</span>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td>
                  <div className='pt-stack'>
                    <span className='pt-mono'>
                      {(o.request_path || '').replace(/^\//, '') || '—'}
                    </span>
                    {r.group ? <span className='pt-sub'>分组 {r.group}</span> : null}
                  </div>
                </td>
                <td className='pt-sub pt-mono' style={{ whiteSpace: 'nowrap' }}>
                  {r.ip || '—'}
                </td>
                <td>
                  <span className='pt-tag plain'>{r.is_stream ? '流式' : '非流式'}</span>
                </td>
                <td className='pt-num'>
                  <div className='pt-stack'>
                    <span className='pt-tok'>
                      <i className='pt-arrow in'>↓</i>
                      {fmtInt(r.prompt_tokens)}
                      <i className='pt-arrow out'>↑</i>
                      {fmtInt(r.completion_tokens)}
                    </span>
                    <span className='pt-sub'>缓存 {fmtInt(cache)}</span>
                  </div>
                </td>
                <td>
                  <div className='pt-cell-row'>
                    <i className={`pt-lat-bar ${latencyClass(r.use_time)}`} />
                    <div className='pt-stack'>
                      <span className='pt-sub'>首字 {ms(frt)}</span>
                      <span className='pt-sub'>
                        总耗时 {r.use_time ? r.use_time + 's' : '—'}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  {failed ? (
                    // 「失败」两个字没法告诉人该改什么，服务端原文才有用。
                    // 展开成一行而不是浮窗：不用引库，键盘也能用。
                    <button
                      type='button'
                      className={`pt-tag ${out.cls} pt-tag-btn`}
                      aria-expanded={openId === r.id}
                      onClick={() => onToggleErr(r.id)}
                    >
                      {out.text}
                      <span aria-hidden='true'>{openId === r.id ? ' ▴' : ' ▾'}</span>
                    </button>
                  ) : (
                    <span className={`pt-tag ${out.cls}`}>{out.text}</span>
                  )}
                </td>
                <td className='pt-sub' style={{ whiteSpace: 'nowrap' }}>
                  {fmtLogTime(r.created_at)}
                </td>
              </tr>
              {openId === r.id && failed ? (
                <tr className='pt-err-row'>
                  <td colSpan={8}>
                    <div className='pt-err-box'>{r.content}</div>
                  </td>
                </tr>
              ) : null}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

/*
 * 窄屏卡片。八列的表格在手机上只能横向拖，逐条读不了，
 * 但信息一条都不能少——不是把列删掉，是换个排法。
 */
export function ChatCards({ rows }) {
  const [open, setOpen] = useState(null);
  return (
    <div className='pt-rec-cards'>
      {rows.map((r) => {
        const { o, out, upstream, frt, cache } = Cells({ r });
        const failed = r.type === 5 && r.content;
        return (
          <article key={r.id} className='pt-rec-card'>
            <div className='pt-rec-top'>
              <span className='pt-sub'>{fmtLogTime(r.created_at)}</span>
              <span className={`pt-tag ${out.cls}`}>{out.text}</span>
            </div>
            <div className='pt-cell-row' style={{ marginTop: 6 }}>
              <ModelIcon model={r.model_name} size={16} />
              <span className='pt-mono'>{r.model_name || '—'}</span>
            </div>
            {upstream ? (
              <div className='pt-sub pt-mono'>└ {upstream}</div>
            ) : null}
            {failed ? (
              <button
                type='button'
                className='pt-err-toggle'
                aria-expanded={open === r.id}
                onClick={() => setOpen(open === r.id ? null : r.id)}
              >
                {open === r.id ? '收起错误详情' : '查看错误详情'}
              </button>
            ) : null}
            {open === r.id && failed ? (
              <div className='pt-err-box'>{r.content}</div>
            ) : null}
            <dl className='pt-rec-grid'>
              <div><dt>输入</dt><dd>{fmtInt(r.prompt_tokens)}</dd></div>
              <div><dt>输出</dt><dd>{fmtInt(r.completion_tokens)}</dd></div>
              <div><dt>缓存</dt><dd>{fmtInt(cache)}</dd></div>
              <div><dt>首字</dt><dd>{ms(frt)}</dd></div>
              <div><dt>总耗时</dt><dd>{r.use_time ? r.use_time + 's' : '—'}</dd></div>
              <div><dt>类型</dt><dd>{r.is_stream ? '流式' : '非流式'}</dd></div>
            </dl>
            <div className='pt-rec-foot pt-sub pt-mono'>
              {(o.request_path || '').replace(/^\//, '') || '—'}
              {r.ip ? ' · ' + r.ip : ''}
            </div>
          </article>
        );
      })}
    </div>
  );
}
