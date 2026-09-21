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

import React, { useCallback, useEffect, useState } from 'react';
import { API, showError } from '../../helpers';
import { ChatCards, ChatTable } from './ChatLog';
import { HIDDEN } from './modelCatalog';
import {
  Card,
  Empty,
  PageHead,
  Pager,
  RangeFilter,
  rangeParams,
  useUrlState,
  usePortalT,
} from './shared';
import { taskState } from './taskInfo';

/*
 * 使用记录：账号下每一次调用。出图（qwen-image）和视频任务的提交也记在这里，
 * 它们和对话共用同一张日志表，只是列的含义不同——见 ChatLog.jsx。
 *
 * 视频这类异步任务，日志只记下「提交出去了」——真正的进度存在另一张表里。
 * 所以当页出现任务行时，这里按日志里的 task_id 把对应的任务捞一次，
 * 直接把「生成中 40%」「成功 + 查看」显示在那一行上。还有在跑的就每 10 秒再捞一次，
 * 只捞任务、不重拉整页日志——日志写完就不会变，陪着刷是白费。
 * 全量清单和按状态筛仍在「任务队列」（/console/task）。
 */

const PAGE_SIZE = 20;

/*
 * 筛选全部走服务端。只筛当前这一页是骗人的——翻到第二页筛选条件就失效了，
 * 而且计数对不上。接口支持 type / start_timestamp / end_timestamp / model_name。
 */
/*
 * 地址栏里认这几个参数。默认值不会出现在地址栏里，所以干净的页面就是干净的 URL。
 * token 这个名字是从密钥页「查看调用记录」跳过来时带的，不能改。
 */
const URL_DEFAULTS = {
  p: 1,
  token: '',
  model: '',
  range: '7d',
  from: '',
  to: '',
  failed: false,
};

export default function PortalRecords() {
  const t = usePortalT();
  // 所有筛选和页码都住在地址栏里：刷新、分享链接、前进后退都还是这一屏
  const [urlState, patch] = useUrlState(URL_DEFAULTS);
  const page = urlState.p;
  const onlyFailed = urlState.failed;
  const model = urlState.model;
  const tokenName = urlState.token;
  // RangeFilter 要的是 {range, from, to} 这个形状
  const range = { range: urlState.range, from: urlState.from, to: urlState.to };
  const setPage = (n) => patch({ p: typeof n === 'function' ? n(page) : n });
  const [models, setModels] = useState([]);
  const [tokenNames, setTokenNames] = useState([]);
  const [openErr, setOpenErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  // 日志里的任务行 → tasks 表里那条任务（按 task_id）
  const [tasks, setTasks] = useState({});

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

  const { range: rangeKey, from, to } = urlState;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 「只看失败」在日志里就是 type=5
      const q = [
        `p=${page}`,
        `page_size=${PAGE_SIZE}`,
        // range 每次渲染都是新对象，不能进依赖，这里按原始字段传
        ...rangeParams({ range: rangeKey, from, to }),
      ];
      if (onlyFailed) q.push('type=5');
      if (model) q.push('model_name=' + encodeURIComponent(model));
      if (tokenName) q.push('token_name=' + encodeURIComponent(tokenName));
      const res = await API.get(`/api/log/self?${q.join('&')}`);
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
  }, [page, onlyFailed, rangeKey, from, to, model, tokenName, t]);

  useEffect(() => {
    load();
  }, [load]);

  /*
   * 当页的任务行 → 对应的任务。接口按时间窗口查，所以窗口取这些行的提交时间
   * 前后各留一分钟，够把它们全包进去；查不到的行会退回成一条「查看任务进度」链接。
   */
  const taskIds = rows
    .map((r) => {
      try {
        const o = typeof r.other === 'string' ? JSON.parse(r.other) : r.other;
        return o?.is_task ? o.task_id : null;
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);
  const taskKey = taskIds.join(',');
  const times = rows.map((r) => Number(r.created_at || 0)).filter(Boolean);

  const loadTasks = useCallback(async () => {
    if (!taskKey) {
      setTasks({});
      return;
    }
    try {
      const wanted = new Set(taskKey.split(','));
      const q = [
        'p=1',
        'page_size=100',
        'start_timestamp=' + (Math.min(...times) - 60),
        'end_timestamp=' + (Math.max(...times) + 60),
      ];
      const res = await API.get(`/api/task/self?${q.join('&')}`);
      if (!res.data?.success) return;
      const d = res.data.data;
      const items = Array.isArray(d) ? d : d?.items || [];
      const map = {};
      items.forEach((it) => {
        if (wanted.has(it.task_id)) map[it.task_id] = it;
      });
      setTasks(map);
    } catch (e) {
      // 查不到就退回链接，不值得为此弹个错
    }
    // times 每次渲染都是新数组，进依赖会把这个 effect 变成死循环；
    // 真正决定要查什么的是 taskKey。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskKey]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // 还有任务在跑就接着刷，跑完自动停
  const anyRunning = Object.values(tasks).some((it) => taskState(it).running);
  useEffect(() => {
    if (!anyRunning) return undefined;
    const id = setInterval(loadTasks, 10000);
    return () => clearInterval(id);
  }, [anyRunning, loadTasks]);

  // 任务行那一格显示的是「已经等了多久」，每秒重渲染一次才会走（不发请求）
  const [, tick] = useState(0);
  useEffect(() => {
    if (!anyRunning) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [anyRunning]);
  // 换了筛选条件就把展开的错误详情收起来（页码回第 1 页由 useUrlState 负责）
  useEffect(() => {
    setOpenErr(null);
  }, [onlyFailed, rangeKey, from, to, model, tokenName]);

  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHead title={t('使用记录')} sub={t('你的每一次调用')} />

      <div className='pt-filters'>
        <RangeFilter value={range} onChange={(v) => patch(v)} />
        <label className='pt-field'>
              <span className='pt-field-label'>{t('模型')}</span>
              <select
                className='pt-select'
                aria-label={t('按模型筛选')}
                value={model}
                onChange={(e) => patch({ model: e.target.value })}
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
                onChange={(e) => patch({ token: e.target.value })}
              >
                <option value=''>{t('全部')}</option>
                {tokenNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
        <label className='pt-check'>
          <input
            type='checkbox'
            checked={onlyFailed}
            onChange={(e) => patch({ failed: e.target.checked })}
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
            <div className='pt-wide-only'>
              <ChatTable
                rows={rows}
                openId={openErr}
                onToggleErr={(id) => setOpenErr(openErr === id ? null : id)}
                tasks={tasks}
              />
            </div>
            {/* 七列的表在手机上只能横向拖，改成一条一张卡，信息不删 */}
            <div className='pt-narrow-only'>
              <ChatCards rows={rows} tasks={tasks} />
            </div>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <Pager
            page={page}
            maxPage={maxPage}
            total={total}
            pageSize={PAGE_SIZE}
            onPage={setPage}
          />
        )}
      </Card>
    </div>
  );
}
