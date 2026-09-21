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
import { Card, Empty, PageHead, fmtInt, usePortalT } from './shared';

/*
 * 使用记录：账号下每一次调用。出图（qwen-image）和视频任务的提交也记在这里，
 * 它们和对话共用同一张日志表，只是列的含义不同——见 ChatLog.jsx。
 *
 * 异步任务真正的进度不在这页：那是「任务队列」（/console/task）的事，
 * 它的字段（状态、进度、结果链接）和日志没有重叠，合成一张表只会两头都难看。
 */

const PAGE_SIZE = 20;

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
      // 「只看失败」在日志里就是 type=5
      const q = [`p=${page}`, `page_size=${PAGE_SIZE}`];
      const hours = RANGES.find((r) => r.key === range)?.hours || 0;
      if (hours) {
        q.push(
          'start_timestamp=' + (Math.floor(Date.now() / 1000) - hours * 3600),
        );
        q.push('end_timestamp=' + Math.floor(Date.now() / 1000));
      }
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
  }, [page, onlyFailed, range, model, tokenName, t]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setPage(1);
    setOpenErr(null);
  }, [onlyFailed, range, model, tokenName]);

  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHead title={t('使用记录')} sub={t('你的每一次调用')} />

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
            <div className='pt-wide-only'>
              <ChatTable
                rows={rows}
                openId={openErr}
                onToggleErr={(id) => setOpenErr(openErr === id ? null : id)}
              />
            </div>
            {/* 七列的表在手机上只能横向拖，改成一条一张卡，信息不删 */}
            <div className='pt-narrow-only'>
              <ChatCards rows={rows} />
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
