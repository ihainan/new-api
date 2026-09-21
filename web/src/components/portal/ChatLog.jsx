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
import { Link } from 'react-router-dom';
import ModelIcon from './ModelIcon';
import { fmtInt, fmtLogTime, usePortalT } from './shared';
import { taskDuration, taskResultUrl, taskState } from './taskInfo';

/*
 * 对话日志的表格与窄屏卡片。
 *
 * 之前这张表只有时间/模型/结果/输入/输出/耗时六列，而日志行里其实还躺着
 * 首字延迟、缓存命中、入站路径、是否流式、以及被映射到的真实上游模型
 * ——这些都是排查「为什么慢」「为什么贵」「到底调到了谁」时最要紧的信息。
 * 全在 other 那段 JSON 里，白白存着没给人看。
 *
 * 不显示客户端 IP：那一列由用户设置里的「记录 IP」开关决定，默认关闭，
 * 本部署没有任何一行记了 IP，摆一列全是「—」只会让人以为是坏了。
 *
 * 另外这张表里混着三种行，不能按同一套列渲染：
 *   对话  —— 按 token 计费，有首字延迟；
 *   绘图  —— 同步出图，按张计费，没有 token 也没有首字；
 *   任务  —— 异步提交（视频），这行只记「提交成功」，token 和耗时全是 0；
 *   退款  —— 任务失败后系统自动退费写的一行（type 6）。它既没有 is_task 也没有
 *            请求路径，不单独认的话会被当成对话行，又渲染成一排 0。
 * 早先三种一视同仁，minimax-h3 那行就显示成一排 0 和 0s，看着像坏了。
 *
 * 任务行的真实状态来自 tasks 表：调用方按日志里的 task_id 查到对应任务，
 * 从 tasks 这个 prop 传进来，于是「生成中」「成功 + 打开视频」就直接显示在这一行。
 * 查不到（老记录没有 task_id）才退回一句链接。
 *
 * 这里只给一句结论，不画三步进度条：那是「盯着它跑」时才需要的东西，属于任务队列页。
 * 日志一行回答的是「这次调用是什么、跑了多久、成没成」，和别的行一样高，
 * 塞进进度条只会让这一行鼓出来。
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

// chat / image / task / refund，见文件头注释
function rowKind(o, row) {
  // 退款是日志自己的类型，不用猜
  if (row.type === 6) return 'refund';
  if (o.is_task) return 'task';
  const p = String(o.request_path || '');
  if (p.includes('/images') || p.includes('/videos')) return 'image';
  return 'chat';
}

// 绘图和任务不按 token 计费，计费参数后端只写在 content 这段中文串里。
// 解析不出来就退回「—」，绝不显示成 0。
function usageOf(row, kind) {
  const c = String(row.content || '');
  if (kind === 'task') {
    const sec = c.match(/seconds:\s*([\d.]+)/);
    return { main: sec ? Math.round(Number(sec[1])) + 's' : '—', sub: '视频' };
  }
  const size = c.match(/(\d{2,5})\s*[x×]\s*(\d{2,5})/);
  const n = c.match(/生成数量\s*(\d+)/);
  return {
    main: size ? size[1] + '×' + size[2] : '—',
    sub: n ? '{{n}} 张' : null,
    n: n ? n[1] : null,
  };
}

// 返回的是中文原文，同时也是 i18n 的 key——这是个普通函数，不能用 hook，
// 由调用它的组件去 t() 包。
export function chatOutcome(row) {
  if (row.type === 5) return { cls: 'bad', text: '失败' };
  const o = parseOther(row);
  // 任务行只代表「提交成功」，说成「成功」会让人以为视频已经出好了
  if (o.is_task) return { cls: 'ok', text: '已提交' };
  const end = o.stream_status?.end_reason;
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

function Cells({ r, tasks }) {
  const o = parseOther(r);
  const out = chatOutcome(r);
  const kind = rowKind(o, r);
  // routed_model 是上游自己二次路由后真正跑的模型（smart-router 背后那台），
  // 它比模型映射更接近事实，两者都有时以它为准
  const real = o.routed_model || (o.is_model_mapped ? o.upstream_model_name : null);
  const frt = firstToken(o, r.is_stream);
  const cache = Number(o.cache_tokens || 0);
  const usage = kind === 'chat' || kind === 'refund' ? null : usageOf(r, kind);
  // 退款行也带着 task_id，同样能把它对应的任务查出来
  const task = o.task_id ? tasks?.[o.task_id] : null;
  return { o, out, kind, upstream: real, frt, cache, usage, task };
}

// 各类行的「类型」列各说各的
const KIND_LABEL = { image: '绘图', task: '异步任务', refund: '退款' };

/*
 * 退款行的「结果」：这行本身不是一次调用，是任务失败之后系统把钱退回来。
 * 直接说「任务失败，费用已退回」，再把上游给的原因摆出来。
 */
function RefundOutcome({ row, other }) {
  const t = usePortalT();
  const reason = other.reason || row.content || '';
  return (
    <div className='pt-stack'>
      <span className='pt-tag warn'>{t('已退款')}</span>
      <span className='pt-sub'>{reason || t('任务失败，费用已退回')}</span>
    </div>
  );
}

/*
 * 任务行的「结果」：显示任务此刻的状态，而不是日志那行写死的「已提交」。
 * 提交成功和视频生成成功是两回事，混在一起说会让人以为东西已经出来了。
 *
 * 成了就把视频链接摆在状态旁边——同一行，不换行，行高和别的记录保持一致。
 */
function TaskOutcome({ task }) {
  const t = usePortalT();
  const st = taskState(task);
  const url = task.status === 'SUCCESS' ? taskResultUrl(task) : '';
  return (
    <div className='pt-cell-row'>
      <span className={`pt-tag ${st.cls}`}>{t(st.text)}</span>
      {url ? (
        <a className='pt-linkish' href={url} target='_blank' rel='noreferrer'>
          {t('打开视频')}
        </a>
      ) : null}
    </div>
  );
}

export function ChatTable({ rows, openId, onToggleErr, tasks }) {
  const t = usePortalT();
  return (
    <table className='pt-table pt-log-table'>
      <thead>
        <tr>
          <th>{t('模型')}</th>
          <th>{t('端点')}</th>
          <th>{t('类型')}</th>
          <th className='pt-num'>{t('用量')}</th>
          <th>{t('延迟')}</th>
          <th>{t('结果')}</th>
          <th>{t('时间')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const { o, out, kind, upstream, frt, cache, usage, task } = Cells({
            r,
            tasks,
          });
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
                    {r.group ? (
                      <span className='pt-sub'>
                        {t('分组 {{name}}', { name: r.group })}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td>
                  <span className='pt-tag plain'>
                    {t(KIND_LABEL[kind] || (r.is_stream ? '流式' : '非流式'))}
                  </span>
                </td>
                <td className='pt-num'>
                  <div className='pt-stack'>
                    {kind === 'refund' ? (
                      <span className='pt-sub'>—</span>
                    ) : usage ? (
                      <>
                        <span className='pt-mono'>{usage.main}</span>
                        {usage.sub ? (
                          <span className='pt-sub'>
                            {t(usage.sub, { n: usage.n })}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <span className='pt-tok'>
                          <i className='pt-arrow in'>↓</i>
                          {fmtInt(r.prompt_tokens)}
                          <i className='pt-arrow out'>↑</i>
                          {fmtInt(r.completion_tokens)}
                        </span>
                        <span className='pt-sub'>
                          {t('缓存 {{n}}', { n: fmtInt(cache) })}
                        </span>
                      </>
                    )}
                  </div>
                </td>
                <td>
                  {kind === 'refund' ? (
                    <span className='pt-sub'>—</span>
                  ) : kind === 'task' ? (
                    // 日志那行的 use_time 是 0（提交就返回了），任务真正跑了多久
                    // 要从 tasks 表算：提交到结束，没结束就是「已等这么久」。
                    task ? (
                      <div className='pt-cell-row'>
                        <i className={`pt-lat-bar ${taskState(task).bar}`} />
                        <span className='pt-sub'>
                          {task.finish_time
                            ? taskDuration(task)
                            : t('{{v}}（进行中）', { v: taskDuration(task) })}
                        </span>
                      </div>
                    ) : (
                      // 查不到对应任务（改动之前的老记录没记 task_id），只能给条路
                      <Link className='pt-linkish' to='/console/task'>
                        {t('查看任务进度')}
                      </Link>
                    )
                  ) : (
                    <div className='pt-cell-row'>
                      <i className={`pt-lat-bar ${latencyClass(r.use_time)}`} />
                      <div className='pt-stack'>
                        {kind === 'chat' ? (
                          <span className='pt-sub'>
                            {t('首字 {{v}}', { v: ms(frt) })}
                          </span>
                        ) : null}
                        <span className='pt-sub'>
                          {t('总耗时 {{v}}', {
                            v: r.use_time ? r.use_time + 's' : '—',
                          })}
                        </span>
                      </div>
                    </div>
                  )}
                </td>
                <td>
                  {kind === 'refund' ? (
                    <RefundOutcome row={r} other={o} />
                  ) : kind === 'task' && task ? (
                    <TaskOutcome task={task} />
                  ) : failed ? (
                    // 「失败」两个字没法告诉人该改什么，服务端原文才有用。
                    // 展开成一行而不是浮窗：不用引库，键盘也能用。
                    <button
                      type='button'
                      className={`pt-tag ${out.cls} pt-tag-btn`}
                      aria-expanded={openId === r.id}
                      onClick={() => onToggleErr(r.id)}
                    >
                      {t(out.text)}
                      <span aria-hidden='true'>
                        {openId === r.id ? ' ▴' : ' ▾'}
                      </span>
                    </button>
                  ) : (
                    <span className={`pt-tag ${out.cls}`}>{t(out.text)}</span>
                  )}
                </td>
                <td className='pt-sub' style={{ whiteSpace: 'nowrap' }}>
                  {fmtLogTime(r.created_at)}
                </td>
              </tr>
              {openId === r.id && failed ? (
                <tr className='pt-err-row'>
                  <td colSpan={7}>
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
export function ChatCards({ rows, tasks }) {
  const t = usePortalT();
  const [open, setOpen] = useState(null);
  return (
    <div className='pt-rec-cards'>
      {rows.map((r) => {
        const { o, out, kind, upstream, frt, cache, usage, task } = Cells({
          r,
          tasks,
        });
        const failed = r.type === 5 && r.content;
        return (
          <article key={r.id} className='pt-rec-card'>
            <div className='pt-rec-top'>
              <span className='pt-sub'>{fmtLogTime(r.created_at)}</span>
              {kind === 'refund' ? (
                <span className='pt-tag warn'>{t('已退款')}</span>
              ) : kind === 'task' && task ? (
                <span className={`pt-tag ${taskState(task).cls}`}>
                  {t(taskState(task).text)}
                </span>
              ) : (
                <span className={`pt-tag ${out.cls}`}>{t(out.text)}</span>
              )}
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
                {t(open === r.id ? '收起错误详情' : '查看错误详情')}
              </button>
            ) : null}
            {open === r.id && failed ? (
              <div className='pt-err-box'>{r.content}</div>
            ) : null}
            {kind === 'refund' ? (
              <div className='pt-sub' style={{ marginTop: 6 }}>
                {o.reason || t('任务失败，费用已退回')}
              </div>
            ) : null}
            <dl className='pt-rec-grid'>
              {kind === 'refund' ? null : usage ? (
                // 绘图/任务：窄屏上同样不能摆一排 0，只列它真正的计费参数
                <>
                  <div>
                    <dt>{t('用量')}</dt>
                    <dd>{usage.main}</dd>
                  </div>
                  <div>
                    <dt>{t('类型')}</dt>
                    <dd>{t(KIND_LABEL[kind])}</dd>
                  </div>
                  <div>
                    <dt>{t('总耗时')}</dt>
                    <dd>
                      {kind === 'task' ? (
                        task ? (
                          task.finish_time ? (
                            taskDuration(task)
                          ) : (
                            t('{{v}}（进行中）', { v: taskDuration(task) })
                          )
                        ) : (
                          // 老记录没有 task_id，查不到对应任务
                          <Link className='pt-linkish' to='/console/task'>
                            {t('查看任务进度')}
                          </Link>
                        )
                      ) : r.use_time ? (
                        r.use_time + 's'
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <dt>{t('输入')}</dt>
                    <dd>{fmtInt(r.prompt_tokens)}</dd>
                  </div>
                  <div>
                    <dt>{t('输出')}</dt>
                    <dd>{fmtInt(r.completion_tokens)}</dd>
                  </div>
                  <div>
                    <dt>{t('缓存')}</dt>
                    <dd>{fmtInt(cache)}</dd>
                  </div>
                  <div>
                    <dt>{t('首字')}</dt>
                    <dd>{ms(frt)}</dd>
                  </div>
                  <div>
                    <dt>{t('总耗时')}</dt>
                    <dd>{r.use_time ? r.use_time + 's' : '—'}</dd>
                  </div>
                  <div>
                    <dt>{t('类型')}</dt>
                    <dd>{t(r.is_stream ? '流式' : '非流式')}</dd>
                  </div>
                </>
              )}
            </dl>
            <div className='pt-rec-foot pt-sub pt-mono'>
              {(o.request_path || '').replace(/^\//, '') || '—'}
            </div>
            {kind === 'task' && task?.status === 'SUCCESS' && taskResultUrl(task) ? (
              <a
                className='pt-btn sm'
                style={{ marginTop: 8 }}
                href={taskResultUrl(task)}
                target='_blank'
                rel='noreferrer'
              >
                {t('打开视频')}
              </a>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
