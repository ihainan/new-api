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

import { useTranslation } from 'react-i18next';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { VChart } from '@visactor/react-vchart';
import { API, showError } from '../../helpers';
import { Card, Empty, PageHead, Skeleton, Stat, fmtCompact, fmtInt } from './shared';

/*
 * 概览。只回答「我自己用了多少、体验如何」，不放公告、服务可用性、用户排行
 * 这些管理视角的东西。
 *
 * 数据全部来自 GET /api/log/self/metrics —— 一个按 user_id 聚合的自助接口。
 * 不用 /api/data/self：它按小时+模型返回原始行，算不出缓存占比和首字延迟，
 * 单次查询还被限制在 30 天内。也不用 /api/log/self/stat：它按 username 聚合，
 * 而用户名是可以改的。
 */

const RANGES = [
  { v: '24h', label: '近 24 小时', span: 24 * 3600 },
  { v: 'today', label: '今天', span: null },
  { v: '7d', label: '近 7 天', span: 7 * 86400 },
  { v: '30d', label: '近 30 天', span: 30 * 86400 },
];

function rangeBounds(v) {
  const now = Math.floor(Date.now() / 1000);
  if (v === 'today') {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return [Math.floor(d.getTime() / 1000), now];
  }
  return [now - (RANGES.find((r) => r.v === v)?.span || 86400), now];
}

// 图表配色沿用门户的单色基调，不引入花哨的多彩色板。
const LINE_COLORS = ['#14181f'];
const PIE_COLORS = ['#14181f', '#3d4551', '#626b78', '#8a909b', '#b3b8c0', '#d6d9de'];

export default function PortalOverview() {
  const { t } = useTranslation();
  const [range, setRange] = useState('24h');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [start, end] = rangeBounds(range);
    try {
      const res = await API.get(
        `/api/log/self/metrics?start_timestamp=${start}&end_timestamp=${end}`,
      );
      if (!res.data?.success) {
        showError(res.data?.message || t('加载失败'));
        setData(null);
        return;
      }
      setData(res.data.data);
    } catch (e) {
      showError(t('加载失败'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const lineSpec = useMemo(() => {
    const pts = (data?.series || []).map((p) => ({
      // 区间短时显示到分钟，长时只显示日期，避免 x 轴标签糊成一片
      t: new Date(p.ts * 1000).toLocaleString('zh-CN', {
        hour12: false,
        month: '2-digit', day: '2-digit',
        ...(range === '30d' ? {} : { hour: '2-digit', minute: '2-digit' }),
      }),
      v: p.requests,
    }));
    return {
      type: 'line', data: [{ id: 'd', values: pts }],
      xField: 't', yField: 'v', color: LINE_COLORS,
      point: { visible: false },
      line: { style: { lineWidth: 2 } },
      axes: [
        { orient: 'bottom', label: { autoHide: true, style: { fill: '#8a909b', fontSize: 11 } },
          domainLine: { style: { stroke: '#e7e9ec' } }, tick: { visible: false } },
        { orient: 'left', label: { style: { fill: '#8a909b', fontSize: 11 } },
          grid: { style: { stroke: '#eef0f2' } }, domainLine: { visible: false },
          tick: { visible: false } },
      ],
      tooltip: { mark: { title: { value: '请求数' } } },
      padding: { top: 8, right: 8, bottom: 4, left: 4 },
    };
  }, [data, range]);

  const pieSpec = useMemo(() => {
    const top = (data?.models || []).slice(0, 6);
    return {
      type: 'pie', data: [{ id: 'd', values: top.map((m) => ({ k: m.model_name, v: m.requests })) }],
      categoryField: 'k', valueField: 'v', color: PIE_COLORS,
      outerRadius: 0.9, innerRadius: 0.62,
      label: { visible: false },
      legends: { visible: true, orient: 'right', item: { label: { style: { fontSize: 12 } } } },
      padding: 4,
    };
  }, [data]);

  const na = (v, unit, fallback) =>
    v === null || v === undefined
      ? { value: fallback, unavailable: true }
      : { value: `${v}${unit}`, unavailable: false };

  if (loading && !data) {
    return <div><PageHead title={t('概览')} /><Skeleton rows={5} /></div>;
  }

  const d = data || {};
  const useTime = na(d.avg_use_time_sec, ' 秒', '暂无数据');
  const frt = na(d.avg_first_token_ms, ' ms', '没有流式请求，无法统计');
  const cache = na(d.cache_ratio_pct, '%', '暂无数据');
  const fail = d.error_log_enabled
    ? na(d.fail_ratio_pct, '%', '暂无数据')
    : { value: '未开启错误日志', unavailable: true };

  return (
    <div>
      <PageHead title={t('概览')} sub={t('你自己的调用情况')} />

      <div className='pt-filters'>
        {RANGES.map((r) => (
          <button
            key={r.v}
            type='button'
            className={`pt-btn sm${range === r.v ? ' primary' : ''}`}
            onClick={() => setRange(r.v)}
          >
            {t(r.label)}
          </button>
        ))}
        {loading ? <span style={{ fontSize: 12, color: 'var(--pt-text-muted)' }}>{t('加载中…')}</span> : null}
      </div>

      <div className='pt-stat-grid'>
        <Stat label={t('请求数')} value={fmtInt(d.requests)} />
        <Stat label={t('Token 总量')} value={fmtCompact(d.tokens)} />
        <Stat label={t('输入 / 输出')} value={`${fmtCompact(d.prompt_tokens)} / ${fmtCompact(d.completion_tokens)}`} />
        <Stat label={t('客户端断开')} value={fmtInt(d.client_gone)} hint='记为成功，不计入失败' />
      </div>

      <div className='pt-section'>
        <h2 className='pt-section-title'>{t('质量指标')}</h2>
        <p className='pt-section-sub'>{t('这段时间的实际表现；样本太少时会标明，不会拿 0 充数')}</p>
        <div className='pt-stat-grid' style={{ marginBottom: 0 }}>
          <Stat label={t('平均耗时')} {...useTime} hint={d.use_time_samples ? `${fmtInt(d.use_time_samples)} 次` : undefined} />
          <Stat label={t('首字延迟')} {...frt} hint={d.stream_samples ? `${fmtInt(d.stream_samples)} 次流式` : undefined} />
          <Stat label={t('缓存输入占比')} {...cache} hint='命中缓存的输入 Token 占比' />
          <Stat
            label={t('上游调用失败比例')}
            {...fail}
            hint={d.error_log_enabled ? `${fmtInt(d.failed)} / ${fmtInt(d.fail_denom)}` : '需管理员开启'}
          />
        </div>
      </div>

      <div className='pt-section'>
        <h2 className='pt-section-title'>{t('调用趋势')}</h2>
        <p className='pt-section-sub'>{t('按请求数')}</p>
        <Card>
          {(d.series || []).some((p) => p.requests > 0) ? (
            <div style={{ height: 260, padding: 12 }}>
              <VChart spec={lineSpec} option={{ mode: 'desktop-browser' }} />
            </div>
          ) : (
            <Empty text={t('这段时间还没有调用记录')} />
          )}
        </Card>
      </div>

      <div className='pt-section'>
        <h2 className='pt-section-title'>{t('模型分布')}</h2>
        <p className='pt-section-sub'>{t('按请求数，取前 6 个')}</p>
        <Card>
          {(d.models || []).length === 0 ? (
            <Empty text={t('这段时间还没有调用记录')} />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 0 }}>
              <div style={{ height: 240, padding: 12 }}>
                <VChart spec={pieSpec} option={{ mode: 'desktop-browser' }} />
              </div>
              <div className='pt-table-wrap'>
                <table className='pt-table'>
                  <thead>
                    <tr><th>{t('模型')}</th><th className='pt-num'>{t('请求')}</th><th className='pt-num'>{t('占比')}</th><th className='pt-num'>Token</th></tr>
                  </thead>
                  <tbody>
                    {(d.models || []).map((m) => (
                      <tr key={m.model_name}>
                        <td style={{ fontFamily: 'var(--pt-mono)' }}>{m.model_name}</td>
                        <td className='pt-num'>{fmtInt(m.requests)}</td>
                        <td className='pt-num'>
                          {d.requests ? ((m.requests / d.requests) * 100).toFixed(1) : '0.0'}%
                        </td>
                        <td className='pt-num'>{fmtCompact(m.tokens)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
