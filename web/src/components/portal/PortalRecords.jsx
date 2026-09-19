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
import { Card, Empty, PageHead, Skeleton, Tabs, fmtCompact, fmtInt, fmtTime } from './shared';

/*
 * 使用记录。三类记录（对话 / 绘图 / 任务）各有各的字段，硬塞进一张统一的稀疏表
 * 会丢信息，所以这里是「一个页面框架 + 类型切换 + 各自的表格」。
 * 本期不提供「全部类型」：跨三个数据源做全局时间排序与稳定分页需要新的后端聚合。
 */

const PAGE_SIZE = 20;

const TABS = [
  { key: 'chat', label: '对话' },
  { key: 'draw', label: '绘图' },
  { key: 'task', label: '任务' },
];

// 对话日志里，失败是单独的一种 type，成功记录里还可能藏着客户端主动断开。
function chatOutcome(row) {
  if (row.type === 5) return { cls: 'bad', text: '失败' };
  let other = row.other;
  if (typeof other === 'string') { try { other = JSON.parse(other); } catch { other = null; } }
  const end = other?.stream_status?.end_reason;
  if (end === 'client_gone') return { cls: 'warn', text: '客户端断开' };
  return { cls: 'ok', text: '成功' };
}

export default function PortalRecords() {
  const [tab, setTab] = useState('chat');
  const [page, setPage] = useState(1);
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const endpoint = useMemo(() => ({
    chat: '/api/log/self',
    draw: '/api/mj/self',
    task: '/api/task/self',
  }[tab]), [tab]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 「只看失败」在对话日志里靠 type=5 表达；绘图与任务各有自己的状态字段，
      // 接口不支持这个筛选，所以只在对话标签下提供。
      const typeParam = tab === 'chat' && onlyFailed ? '&type=5' : '';
      const res = await API.get(`${endpoint}?p=${page}&page_size=${PAGE_SIZE}${typeParam}`);
      if (!res.data?.success) {
        showError(res.data?.message || '加载失败');
        setRows([]); setTotal(0);
        return;
      }
      const d = res.data.data;
      const items = Array.isArray(d) ? d : (d?.items || []);
      setRows(items);
      setTotal(Number(d?.total ?? items.length));
    } catch (e) {
      showError('加载失败');
      setRows([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, onlyFailed, tab]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [tab, onlyFailed]);

  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className='pt-page-wide'>
      <PageHead title='使用记录' sub='你的每一次调用' />

      <Tabs items={TABS} value={tab} onChange={setTab} />

      {tab === 'chat' && (
        <div className='pt-filters'>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
            <input
              type='checkbox'
              checked={onlyFailed}
              onChange={(e) => setOnlyFailed(e.target.checked)}
            />
            只看失败
          </label>
        </div>
      )}

      <Card>
        {loading ? (
          <div style={{ padding: 16 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className='pt-skel' style={{ marginTop: i ? 12 : 0 }} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Empty text={onlyFailed ? '这段时间没有失败记录' : '还没有记录'} />
        ) : (
          <div className='pt-table-wrap'>
            {tab === 'chat' && (
              <table className='pt-table'>
                <thead>
                  <tr>
                    <th>时间</th><th>模型</th><th>结果</th>
                    <th className='pt-num'>输入</th><th className='pt-num'>输出</th>
                    <th className='pt-num'>耗时</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const o = chatOutcome(r);
                    return (
                      <tr key={r.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtTime(r.created_at)}</td>
                        <td style={{ fontFamily: 'var(--pt-mono)' }}>{r.model_name || '—'}</td>
                        <td><span className={`pt-tag ${o.cls}`}>{o.text}</span></td>
                        <td className='pt-num'>{fmtCompact(r.prompt_tokens)}</td>
                        <td className='pt-num'>{fmtCompact(r.completion_tokens)}</td>
                        <td className='pt-num'>{r.use_time ? `${r.use_time}s` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {tab === 'draw' && (
              <table className='pt-table'>
                <thead>
                  <tr>
                    <th>提交时间</th><th>类型</th><th>状态</th><th>进度</th><th>结果</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id || r.mj_id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtTime(r.submit_time)}</td>
                      <td>{r.action || '—'}</td>
                      <td>
                        <span className={`pt-tag ${r.status === 'SUCCESS' ? 'ok' : r.status === 'FAILURE' ? 'bad' : 'plain'}`}>
                          {r.status || '—'}
                        </span>
                      </td>
                      <td>{r.progress || '—'}</td>
                      <td>
                        {r.image_url
                          ? <a className='pt-btn sm' href={r.image_url} target='_blank' rel='noreferrer'>查看</a>
                          : <span style={{ color: 'var(--pt-text-muted)' }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'task' && (
              <table className='pt-table'>
                <thead>
                  <tr>
                    <th>提交时间</th><th>平台</th><th>动作</th><th>状态</th><th>完成时间</th><th>结果</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id || r.task_id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtTime(r.submit_time)}</td>
                      <td>{r.platform || '—'}</td>
                      <td>{r.action || '—'}</td>
                      <td>
                        <span className={`pt-tag ${r.status === 'SUCCESS' ? 'ok' : r.status === 'FAILURE' ? 'bad' : 'plain'}`}>
                          {r.status || '—'}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtTime(r.finish_time)}</td>
                      <td>
                        {r.fail_reason
                          ? <span style={{ color: 'var(--pt-danger-text)' }}>{r.fail_reason}</span>
                          : <span style={{ color: 'var(--pt-text-muted)' }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className='pt-pager'>
            <button type='button' className='pt-btn sm' disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</button>
            <span>第 {page} / {maxPage} 页 · 共 {fmtInt(total)} 条</span>
            <button type='button' className='pt-btn sm' disabled={page >= maxPage}
              onClick={() => setPage((p) => p + 1)}>下一页</button>
          </div>
        )}
      </Card>
    </div>
  );
}
