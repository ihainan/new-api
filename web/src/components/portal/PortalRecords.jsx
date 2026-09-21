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
import { API, showError } from '../../helpers';
import { ChatCards, ChatTable } from './ChatLog';
import { HIDDEN } from './modelCatalog';
import {
  Card,
  Empty,
  PageHead,
  Tabs,
  fmtInt,
  fmtLogTime,
  usePortalT,
} from './shared';

/*
 * 使用记录。三类记录（对话 / 绘图 / 任务）各有各的字段，硬塞进一张统一的稀疏表
 * 会丢信息，所以这里是「一个页面框架 + 类型切换 + 各自的表格」。
 * 本期不提供「全部类型」：跨三个数据源做全局时间排序与稳定分页需要新的后端聚合。
 */

const PAGE_SIZE = 20;

/*
 * 任务行里能给人看的东西藏在 properties 里：platform 存的是渠道类型编号（55），
 * action 是上游原词（textGenerate），直接摆出来没人看得懂。
 */
function taskModel(r) {
  try {
    const p =
      typeof r.properties === 'string' ? JSON.parse(r.properties) : r.properties;
    return p?.origin_model_name || p?.upstream_model_name || '';
  } catch (e) {
    return '';
  }
}

const TASK_ACTION = {
  textGenerate: '文生视频',
  imageGenerate: '图生视频',
  videoGenerate: '视频生成',
};

// 排队和生成中都还没有结果，用中性色；成功绿、失败红，和对话表一致
function taskState(r) {
  const st = String(r.status || '').toUpperCase();
  if (st === 'SUCCESS') return { cls: 'ok', bar: 'fast', text: '成功' };
  if (st === 'FAILURE') return { cls: 'bad', bar: 'slow', text: '失败' };
  const running = ['QUEUED', 'IN_PROGRESS', 'SUBMITTED', 'NOT_START'].includes(st);
  return {
    cls: 'plain',
    bar: running ? 'mid' : 'na',
    text: TASK_STATUS[st] || r.status || '—',
    running,
  };
}

// 生成耗时：没结束的按「已等待」算，让人知道等了多久
function taskDuration(r) {
  const start = Number(r.submit_time || 0);
  if (!start) return '—';
  const end = Number(r.finish_time || 0) || Math.floor(Date.now() / 1000);
  const sec = Math.max(0, end - start);
  const shown = sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return r.finish_time ? shown : `${shown}（进行中）`;
}

const TASK_STATUS = {
  SUCCESS: '成功',
  FAILURE: '失败',
  QUEUED: '排队中',
  IN_PROGRESS: '生成中',
  SUBMITTED: '已提交',
  NOT_START: '未开始',
  UNKNOWN: '未知',
};

/*
 * 没有「绘图」：那个标签读的是 /api/mj/self，即 Midjourney 专用的任务表，
 * 本部署没有这类渠道，永远取不到数据。出图（qwen-image）走的是普通调用，
 * 记在「对话」里。
 */
const TABS = [
  { key: 'chat', label: '对话' },
  { key: 'task', label: '任务' },
];

/*
 * 筛选全部走服务端。只筛当前这一页是骗人的——翻到第二页筛选条件就失效了，
 * 而且计数对不上。接口支持 type / start_timestamp / end_timestamp / model_name。
 */
const RANGES = [
  { key: '24h', label: '近 24 小时', hours: 24 },
  { key: '7d', label: '近 7 天', hours: 24 * 7 },
  { key: '30d', label: '近 30 天', hours: 24 * 30 },
  { key: 'all', label: '全部', hours: 0 },
];

export default function PortalRecords() {
  const t = usePortalT();
  const [tab, setTab] = useState('chat');
  const [page, setPage] = useState(1);
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [range, setRange] = useState('7d');
  const [model, setModel] = useState('');
  const [models, setModels] = useState([]);
  // 从密钥页点「查看调用记录」过来时带着 ?token=名称，直接预选上
  const [tokenName, setTokenName] = useState(
    () => new URLSearchParams(window.location.search).get('token') || '',
  );
  const [tokenNames, setTokenNames] = useState([]);
  const [openErr, setOpenErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const endpoint = useMemo(
    () =>
      ({
        chat: '/api/log/self',
        task: '/api/task/self',
      })[tab],
    [tab],
  );

  // 模型下拉的选项取自「当前可调用的模型」，不是从日志里现扒——
  // 日志里只有用过的，没用过的就筛不到，那个下拉会越用越短。
  useEffect(() => {
    (async () => {
      try {
        const res = await API.get('/api/pricing');
        if (res.data?.success && Array.isArray(res.data.data)) {
          setModels(
            res.data.data
              .map((m) => m.model_name)
              .filter((n) => typeof n === 'string' && n && !HIDDEN.has(n))
              .sort(),
          );
        }
      } catch (e) {
        // 拿不到就只是少一个筛选项，不值得打断整页
      }
    })();
  }, []);

  // 密钥下拉同样取自「账号下的密钥」而不是日志：停用很久没调用过的密钥也该能选到，
  // 否则用它排查「这把 key 到底有没有人在用」就无从下手。
  useEffect(() => {
    (async () => {
      try {
        const res = await API.get('/api/token/?p=0&size=100');
        if (res.data?.success) {
          const names = (res.data.data?.items || [])
            .map((it) => it.name)
            .filter(Boolean);
          setTokenNames([...new Set(names)]);
        }
      } catch (e) {
        // 拿不到就只是少一个筛选项
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      /*
       * 时间范围两个标签都支持；「只看失败」在对话日志里是 type=5，在任务里是
       * status=FAILURE。模型和密钥只有对话日志能筛——任务表里没有这两个可查字段，
       * 所以切到任务时那两个下拉不显示，而不是摆着却不起作用。
       */
      const q = [`p=${page}`, `page_size=${PAGE_SIZE}`];
      const hours = RANGES.find((r) => r.key === range)?.hours || 0;
      if (hours) {
        q.push(
          'start_timestamp=' + (Math.floor(Date.now() / 1000) - hours * 3600),
        );
        q.push('end_timestamp=' + Math.floor(Date.now() / 1000));
      }
      if (tab === 'chat') {
        if (onlyFailed) q.push('type=5');
        if (model) q.push('model_name=' + encodeURIComponent(model));
        if (tokenName) q.push('token_name=' + encodeURIComponent(tokenName));
      } else if (tab === 'task' && onlyFailed) {
        q.push('status=FAILURE');
      }
      const res = await API.get(`${endpoint}?${q.join('&')}`);
      if (!res.data?.success) {
        showError(res.data?.message || t('加载失败'));
        setRows([]);
        setTotal(0);
        return;
      }
      const d = res.data.data;
      const items = Array.isArray(d) ? d : d?.items || [];
      setRows(items);
      setTotal(Number(d?.total ?? items.length));
    } catch (e) {
      showError(t('加载失败'));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, onlyFailed, tab, range, model, tokenName]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setPage(1);
    setOpenErr(null);
  }, [tab, onlyFailed, range, model, tokenName]);

  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHead title={t('使用记录')} sub={t('你的每一次调用')} />

      <Tabs items={TABS} value={tab} onChange={setTab} />

      {/* 筛选条放在标签之外：时间范围和「只看失败」对两个标签都生效 */}
      <div className='pt-filters'>
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
        {/* 模型和密钥只有对话日志能筛，切到任务就不显示——摆着不生效更坑人 */}
        {tab === 'chat' ? (
          <>
            <label className='pt-field'>
              <span className='pt-field-label'>{t('模型')}</span>
              <select
                className='pt-select'
                aria-label={t('按模型筛选')}
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                <option value=''>{t('全部')}</option>
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className='pt-field'>
              <span className='pt-field-label'>{t('密钥')}</span>
              <select
                className='pt-select'
                aria-label={t('按密钥筛选')}
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
              >
                <option value=''>{t('全部')}</option>
                {tokenNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        <label className='pt-check'>
          <input
            type='checkbox'
            checked={onlyFailed}
            onChange={(e) => setOnlyFailed(e.target.checked)}
          />
          {t('只看失败')}
        </label>
      </div>

      <Card>
        {loading ? (
          <div className='pt-skel-card'>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className='pt-skel'
                style={{ marginTop: i ? 12 : 0 }}
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Empty
            text={
              onlyFailed
                ? t('这段时间没有失败记录')
                : tokenName
                  ? t('这段时间没有 {{token}} 的调用记录', { token: tokenName })
                  : model
                    ? t('这段时间没有 {{model}} 的调用记录', { model })
                    : t('这段时间还没有调用记录')
            }
          />
        ) : (
          <div className='pt-table-wrap'>
            {tab === 'chat' && (
              <>
                <div className='pt-wide-only'>
                  <ChatTable
                    rows={rows}
                    openId={openErr}
                    onToggleErr={(id) => setOpenErr(openErr === id ? null : id)}
                  />
                </div>
                {/* 八列的表在手机上只能横向拖，改成一条一张卡，信息不删 */}
                <div className='pt-narrow-only'>
                  <ChatCards rows={rows} />
                </div>
              </>
            )}

            {tab === 'task' && (
              <table className='pt-table'>
                <thead>
                  <tr>
                    <th>{t('模型')}</th>
                    <th>{t('类型')}</th>
                    <th>{t('状态')}</th>
                    <th>{t('耗时')}</th>
                    <th>{t('结果')}</th>
                    <th>{t('提交时间')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const st = taskState(r);
                    return (
                      <tr key={r.id || r.task_id}>
                        {/* 和对话表同一套读法：主值在上、次要信息缩在下面一行 */}
                        <td>
                          <div className='pt-stack'>
                            <span className='pt-mono'>
                              {taskModel(r) || '—'}
                            </span>
                            {/* 任务 ID 要能拿去问人，所以截断的同时把完整值挂在 title 上 */}
                            <span
                              className='pt-sub pt-mono'
                              title={r.task_id || ''}
                            >
                              {r.task_id
                                ? `${String(r.task_id).slice(0, 12)}…`
                                : '—'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className='pt-tag plain'>
                            {t(TASK_ACTION[r.action] || r.action || '—')}
                          </span>
                        </td>
                        <td>
                          <div className='pt-cell-row'>
                            <i className={`pt-lat-bar ${st.bar}`} />
                            <div className='pt-stack'>
                              <span className={`pt-tag ${st.cls}`}>
                                {t(st.text)}
                              </span>
                              {st.running ? (
                                <span className='pt-sub'>
                                  {r.progress || '0%'}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className='pt-sub' style={{ whiteSpace: 'nowrap' }}>
                          {taskDuration(r)}
                        </td>
                        <td>
                          {r.fail_reason ? (
                            <span style={{ color: 'var(--pt-danger-text)' }}>
                              {r.fail_reason}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--pt-text-muted)' }}>
                              —
                            </span>
                          )}
                        </td>
                        <td
                          className='pt-sub'
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          {fmtLogTime(r.submit_time)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
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
