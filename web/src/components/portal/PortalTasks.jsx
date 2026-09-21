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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { API, copy, showError, showSuccess } from '../../helpers';
import ModelIcon from './ModelIcon';
import TaskStatus from './TaskStatus';
import {
  TASK_ACTION,
  taskDuration,
  taskModel,
  taskResultUrl,
  taskState,
} from './taskInfo';
import {
  Card,
  Empty,
  PageHead,
  fmtInt,
  fmtLogTime,
  usePortalT,
} from './shared';

/*
 * 任务队列：所有异步生成（目前是视频）的全量清单，可以按状态筛。
 *
 * 使用记录里那条视频记录也会就地显示它的实时状态（见 ChatLog.jsx），
 * 两边读的是同一张 tasks 表、同一套说法（taskInfo.js）。分成两页是因为
 * 它们回答的问题不同：使用记录回答「我这次调用花了什么」，一行写完就不再变；
 * 这一页回答「我那个视频好了没」，同一行会被后台反复改。
 *
 * 这页有一件日志页不需要的事：只要当前页上还有没跑完的任务，就每 10 秒自动刷一次。
 * 不这么做的话，人盯着「生成中 0%」得自己按 F5。没有在跑的任务就不刷——
 * /api/* 有每 IP 180 次/180 秒的限流，空转没有意义。
 */

const PAGE_SIZE = 20;
const POLL_MS = 10000;

const RANGES = [
  { key: '24h', label: '近 24 小时', hours: 24 },
  { key: '7d', label: '近 7 天', hours: 24 * 7 },
  { key: '30d', label: '近 30 天', hours: 24 * 30 },
  { key: 'all', label: '全部', hours: 0 },
];

/*
 * 状态筛选只列后端认得的单个取值。想筛「所有还没跑完的」得传一组状态，
 * 接口不支持，与其在前端把当前页过滤一遍（翻页就露馅、计数也对不上），
 * 不如先不提供。
 */
const STATES = [
  { key: '', label: '全部' },
  { key: 'IN_PROGRESS', label: '生成中' },
  { key: 'QUEUED', label: '排队中' },
  { key: 'SUCCESS', label: '成功' },
  { key: 'FAILURE', label: '失败' },
];

function TaskId({ r }) {
  const t = usePortalT();
  // 任务 ID 是拿去问人的东西，必须能取到完整值：整段显示、可复制
  return (
    <button
      type='button'
      className='pt-copy-id'
      title={t('点击复制完整 ID')}
      onClick={async () => {
        (await copy(r.task_id || ''))
          ? showSuccess(t('已复制'))
          : showError(t('复制失败'));
      }}
    >
      {r.task_id || '—'}
    </button>
  );
}

function Result({ r }) {
  const t = usePortalT();
  const url = taskResultUrl(r);
  if (r.status === 'SUCCESS' && url) {
    return (
      <a className='pt-btn sm' href={url} target='_blank' rel='noreferrer'>
        {t('打开视频')}
      </a>
    );
  }
  if (r.fail_reason) {
    return <span style={{ color: 'var(--pt-danger-text)' }}>{r.fail_reason}</span>;
  }
  return <span style={{ color: 'var(--pt-text-muted)' }}>—</span>;
}

export default function PortalTasks() {
  const t = usePortalT();
  const [page, setPage] = useState(1);
  const [range, setRange] = useState('7d');
  const [state, setState] = useState('');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [refreshedAt, setRefreshedAt] = useState(0);
  const firstLoad = useRef(true);

  const load = useCallback(
    async (quiet) => {
      if (!quiet) setLoading(true);
      try {
        const q = [`p=${page}`, `page_size=${PAGE_SIZE}`];
        const hours = RANGES.find((r) => r.key === range)?.hours || 0;
        if (hours) {
          const now = Math.floor(Date.now() / 1000);
          q.push('start_timestamp=' + (now - hours * 3600));
          q.push('end_timestamp=' + now);
        }
        if (state) q.push('status=' + state);
        const res = await API.get(`/api/task/self?${q.join('&')}`);
        if (!res.data?.success) {
          if (!quiet) showError(res.data?.message || t('加载失败'));
          return;
        }
        const d = res.data.data;
        const items = Array.isArray(d) ? d : d?.items || [];
        setRows(items);
        setTotal(Number(d?.total ?? items.length));
        setRefreshedAt(Date.now());
      } catch (e) {
        // 自动刷新失败不弹提示：人没点任何东西，弹出来只会莫名其妙
        if (!quiet) showError(t('加载失败'));
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [page, range, state, t],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    setPage(1);
  }, [range, state]);

  // 有任务在跑才轮询，跑完就停
  const running = rows.some((r) => taskState(r).running);
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(id);
  }, [running, load]);

  /*
   * 「耗时」算的是提交到此刻，得每秒重新渲染一次它才会走。只靠 10 秒一次的轮询，
   * 这个数字看上去是卡住的——用户第一眼就是这么反馈的。这一下不发请求。
   */
  const [, tick] = useState(0);
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHead
        title={t('任务队列')}
        sub={t('视频这类异步生成，提交之后在这里看进度和结果')}
      />

      <div className='pt-filters'>
        <label className='pt-field'>
          <span className='pt-field-label'>{t('状态')}</span>
          <select
            className='pt-select'
            aria-label={t('按状态筛选')}
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            {STATES.map((s) => (
              <option key={s.key} value={s.key}>
                {t(s.label)}
              </option>
            ))}
          </select>
        </label>
        <div className='pt-chips' role='group' aria-label={t('时间范围')}>
          {RANGES.map((r) => (
            <button
              key={r.key}
              type='button'
              className={`pt-chip${range === r.key ? ' on' : ''}`}
              aria-pressed={range === r.key}
              onClick={() => setRange(r.key)}
            >
              {t(r.label)}
            </button>
          ))}
        </div>
        {/* 自动刷新是这页的默认行为，但得让人知道它在刷，否则数字自己跳会以为看花眼 */}
        <span className='pt-sub' aria-live='polite'>
          {running
            ? t('有任务在跑，每 10 秒自动刷新')
            : refreshedAt
              ? t('更新于 {{time}}', {
                  time: new Date(refreshedAt).toLocaleTimeString('zh-CN', {
                    hour12: false,
                  }),
                })
              : ''}
        </span>
      </div>

      <Card>
        {loading ? (
          <div className='pt-skel-card'>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className='pt-skel' style={{ marginTop: i ? 12 : 0 }} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Empty
            text={
              state
                ? t('这段时间没有符合条件的任务')
                : t('这段时间还没有提交过任务。视频生成（minimax-h3）会出现在这里。')
            }
          />
        ) : (
          <div className='pt-table-wrap'>
            <div className='pt-wide-only'>
            <table className='pt-table'>
              <thead>
                <tr>
                  <th>{t('模型')}</th>
                  <th>{t('任务 ID')}</th>
                  <th>{t('密钥')}</th>
                  <th>{t('状态')}</th>
                  <th>{t('耗时')}</th>
                  <th>{t('结果')}</th>
                  <th>{t('提交时间')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const mdl = taskModel(r);
                  return (
                    <tr key={r.id || r.task_id}>
                      <td>
                        <div className='pt-cell-row'>
                          <ModelIcon model={mdl} size={16} />
                          <div className='pt-stack'>
                            <span className='pt-mono'>{mdl || '—'}</span>
                            <span className='pt-sub'>
                              {t(TASK_ACTION[r.action] || r.action || '—')}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <TaskId r={r} />
                      </td>
                      <td>
                        <div className='pt-stack'>
                          <span>{r.token_name || '—'}</span>
                          {r.group ? (
                            <span className='pt-sub'>
                              {t('分组 {{name}}', { name: r.group })}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <TaskStatus task={r} />
                      </td>
                      <td className='pt-sub' style={{ whiteSpace: 'nowrap' }}>
                        {r.finish_time
                          ? taskDuration(r)
                          : t('{{v}}（进行中）', { v: taskDuration(r) })}
                      </td>
                      <td>
                        <Result r={r} />
                      </td>
                      <td className='pt-sub' style={{ whiteSpace: 'nowrap' }}>
                        {fmtLogTime(r.submit_time)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {/* 七列的表在手机上只能横向拖，改成一条一张卡，信息不删 */}
            <div className='pt-narrow-only pt-rec-cards'>
              {rows.map((r) => {
                const mdl = taskModel(r);
                return (
                  <article key={r.id || r.task_id} className='pt-rec-card'>
                    <div className='pt-rec-top'>
                      <span className='pt-sub'>{fmtLogTime(r.submit_time)}</span>
                      <TaskStatus task={r} />
                    </div>
                    <div className='pt-cell-row' style={{ marginTop: 6 }}>
                      <ModelIcon model={mdl} size={16} />
                      <span className='pt-mono'>{mdl || '—'}</span>
                    </div>
                    <div className='pt-sub'>
                      {t(TASK_ACTION[r.action] || r.action || '—')}
                    </div>
                    <dl className='pt-rec-grid'>
                      <div>
                        <dt>{t('耗时')}</dt>
                        <dd>
                          {r.finish_time
                            ? taskDuration(r)
                            : t('{{v}}（进行中）', { v: taskDuration(r) })}
                        </dd>
                      </div>
                      <div>
                        <dt>{t('密钥')}</dt>
                        <dd>{r.token_name || '—'}</dd>
                      </div>
                    </dl>
                    <div className='pt-rec-foot'>
                      <TaskId r={r} />
                    </div>
                    {/* 没结果也没失败原因时不留一个孤零零的破折号 */}
                    {r.result_url || r.fail_reason ? (
                      <div style={{ marginTop: 8 }}>
                        <Result r={r} />
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className='pt-pager'>
            <button
              type='button'
              className='pt-btn sm'
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t('上一页')}
            </button>
            <span>
              {t('第 {{page}} / {{max}} 页 · 共 {{total}} 条', {
                page,
                max: maxPage,
                total: fmtInt(total),
              })}
            </span>
            <button
              type='button'
              className='pt-btn sm'
              disabled={page >= maxPage}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('下一页')}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
