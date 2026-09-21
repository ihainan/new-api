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

import { Link } from 'react-router-dom';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { VChart } from '@visactor/react-vchart';
import { API, showError } from '../../helpers';
import { ChatCards, ChatTable } from './ChatLog';
import {
  Card,
  Empty,
  PageHead,
  Skeleton,
  Stat,
  fmtCompact,
  fmtInt,
  usePortalT,
  RangeFilter,
  rangeBounds,
  useUrlState,
} from './shared';

/*
 * 概览。只回答「我自己用了多少、体验如何」，不放公告、服务可用性、用户排行
 * 这些管理视角的东西。
 *
 * 数据全部来自 GET /api/log/self/metrics —— 一个按 user_id 聚合的自助接口。
 * 不用 /api/data/self：它按小时+模型返回原始行，算不出缓存占比和首字延迟，
 * 单次查询还被限制在 30 天内。也不用 /api/log/self/stat：它按 username 聚合，
 * 而用户名是可以改的。
 */

// 图表配色沿用门户的单色基调，不引入花哨的多彩色板。
/*
 * 分布图必须用可区分的颜色：这里颜色不是装饰，它就是编码本身——
 * 负责把扇区和右边的图例对应起来。之前压成六级灰阶，相邻两块几乎分不开，
 * 等于把图例这个功能弄没了。色值和模型页的分类图标同源，整站一套。
 */
const PIE_COLORS = [
  '#2563d4',
  '#157f3c',
  '#8a5cd6',
  '#c9a227',
  '#1d8a8a',
  '#c8372f',
];
// 请求数是单条线；Token 拆三条——缓存输入是省下来的，
// 未缓存输入和输出才是真跑了算力的，混成一条就看不出这个差别。
const LINE_COLOR = {
  // 请求数原来是墨黑，一条又粗又黑的线压在卡片里很难看，且和正文抢注意力。
  // 换成主题色，并在下面垫一层很淡的同色面积——单条线的图表这样才有形。
  requests: ['#4000f6'],
  tokens: ['#4000f6', '#157f3c', '#c9a227'],
};
const TOKEN_SERIES = [
  { key: 'uncached', label: '未缓存输入' },
  { key: 'cached', label: '缓存输入' },
  { key: 'completion', label: '输出' },
];

const TREND_METRICS = [
  { key: 'requests', label: '请求数' },
  { key: 'tokens', label: 'Token' },
];

// 概览默认看近 24 小时（另外两页是近 7 天：那边翻的是明细，跨度要更大）
const OVERVIEW_URL_DEFAULTS = { range: '24h', from: '', to: '' };

// 上游调用失败比例暂时不对用户展示（产品决定，2026-09-21）。
// 后端数据照常返回，恢复时把这里改回 true 即可。
const SHOW_FAIL_RATE = false;

export default function PortalOverview() {
  const t = usePortalT();
  // 时间范围也写进地址栏，和使用记录/任务队列一个规矩
  const [urlState, patch] = useUrlState(OVERVIEW_URL_DEFAULTS);
  const range = { range: urlState.range, from: urlState.from, to: urlState.to };
  const { range: rangeKey, from, to } = urlState;
  // 趋势图看哪个口径。后端每个时间点本来就同时返回请求数和 Token，
  // 之前只画了请求数——不是数据没有，是前端没用。
  const [trend, setTrend] = useState('requests');
  // 最近几次调用直接放在概览上：出了问题的人第一反应是看「我刚才那次怎么了」，
  // 不该逼他先跳到使用记录页再翻。
  const [recent, setRecent] = useState([]);
  const [openErr, setOpenErr] = useState(null);
  /*
   * 刷新失败时保留上一次的数据，只在顶上挂一条说明。
   * 把整页清空换成一个错误提示，等于把用户已经看到的信息也拿走了——
   * 而那些数据并没有失效，只是没能更新。
   */
  const [staleAt, setStaleAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    // range 每次渲染都是新对象，不能进依赖，按原始字段传
    const [start, end] = rangeBounds({ range: rangeKey, from, to });
    try {
      const res = await API.get(
        `/api/log/self/metrics?start_timestamp=${start}&end_timestamp=${end}`,
      );
      if (!res.data?.success) {
        showError(res.data?.message || t('加载失败'));
        // 不清空：旧数据没失效，只是没更新。清掉等于把用户已经看到的也拿走。
        setStaleAt(Date.now());
        return;
      }
      setData(res.data.data);
      setStaleAt(null);
    } catch (e) {
      showError(t('加载失败'));
      setStaleAt(Date.now());
    } finally {
      setLoading(false);
    }
  }, [rangeKey, from, to, t]);

  useEffect(() => {
    load();
  }, [load]);

  // 最近调用和上面的统计各取各的：这一份不跟着时间范围变，
  // 永远是「最新几条」，出问题时要看的就是刚才那几次。
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await API.get('/api/log/self?p=1&page_size=5');
        if (!alive) return;
        const d = res.data?.data;
        setRecent(Array.isArray(d?.items) ? d.items : []);
      } catch (e) {
        // 概览的主体是上面的统计，这一块拿不到就不显示，不打断整页
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const lineSpec = useMemo(() => {
    // 区间短时显示到分钟，长时只显示日期，避免 x 轴标签糊成一片
    const label = (p) =>
      new Date(p.ts * 1000).toLocaleString('zh-CN', {
        hour12: false,
        month: '2-digit',
        day: '2-digit',
        // 跨度大的时候只显示日期，否则 x 轴标签糊成一片
        ...(rangeKey === '30d' || rangeKey === 'all' || rangeKey === 'custom'
          ? {}
          : { hour: '2-digit', minute: '2-digit' }),
      });
    const src = data?.series || [];
    const pts =
      trend === 'tokens'
        ? src.flatMap((p) => {
            const cached = p.cached_tokens || 0;
            return [
              // 未缓存输入 = 输入总量 − 命中缓存的部分。夹一下 0：
              // 两个数来自不同的记录来源，理论上不该为负，但不值得赌。
              {
                t: label(p),
                k: t('未缓存输入'),
                v: Math.max(0, (p.prompt_tokens || 0) - cached),
              },
              { t: label(p), k: t('缓存输入'), v: cached },
              { t: label(p), k: t('输出'), v: p.completion_tokens || 0 },
            ];
          })
        : src.map((p) => ({ t: label(p), k: t('请求数'), v: p.requests }));
    return {
      // 单条线用面积图（线 + 淡填充）；三条线叠面积会互相糊住，还是用线
      type: trend === 'requests' ? 'area' : 'line',
      data: [{ id: 'd', values: pts }],
      xField: 't',
      yField: 'v',
      seriesField: 'k',
      color: LINE_COLOR[trend],
      legends:
        trend === 'tokens'
          ? {
              visible: true,
              orient: 'top',
              padding: { bottom: 6 },
              item: { label: { style: { fontSize: 12 } } },
            }
          : { visible: false },
      point: { visible: false },
      line: { style: { lineWidth: 2 } },
      area: {
        visible: trend === 'requests',
        style: {
          fill: {
            gradient: 'linear',
            x0: 0,
            y0: 0,
            x1: 0,
            y1: 1,
            stops: [
              { offset: 0, color: '#4000f6', opacity: 0.16 },
              { offset: 1, color: '#4000f6', opacity: 0.02 },
            ],
          },
        },
      },
      axes: [
        {
          orient: 'bottom',
          label: { autoHide: true, style: { fill: '#8a909b', fontSize: 11 } },
          domainLine: { style: { stroke: '#e7e9ec' } },
          tick: { visible: false },
        },
        {
          orient: 'left',
          label: { style: { fill: '#8a909b', fontSize: 11 } },
          grid: { style: { stroke: '#eef0f2' } },
          domainLine: { visible: false },
          tick: { visible: false },
        },
      ],

      padding: { top: 8, right: 8, bottom: 4, left: 4 },
    };
  }, [data, rangeKey, trend, t]);

  const pieSpec = useMemo(() => {
    const top = (data?.models || []).slice(0, 6);
    return {
      type: 'pie',
      data: [
        {
          id: 'd',
          values: top.map((m) => ({ k: m.model_name, v: m.requests })),
        },
      ],
      categoryField: 'k',
      valueField: 'v',
      color: PIE_COLORS,
      outerRadius: 0.9,
      innerRadius: 0.62,
      label: { visible: false },
      // 图例合进了下面的表格，这里不再单独画一份
      legends: { visible: false },
      padding: 4,
    };
  }, [data]);

  /*
   * 平均值下面那行小字：有 P95 就写 P95，没有就退回样本数。
   * 样本不足 20 条时后端不给 P95——十来个样本算出来的「95 分位」
   * 其实就是最大值，写成 P95 是在给一个假的可信度。
   */
  const tailHint = (p95, unit, n, nUnit) => {
    const parts = [];
    if (p95 !== null && p95 !== undefined) parts.push(`P95 ${p95}${unit}`);
    if (n) parts.push(`${fmtInt(n)} ${nUnit}`);
    return parts.length ? parts.join(' · ') : undefined;
  };

  const na = (v, unit, fallback) =>
    v === null || v === undefined
      ? { value: fallback, unavailable: true }
      : { value: `${v}${unit}`, unavailable: false };

  if (loading && !data) {
    return (
      <div>
        <PageHead title={t('概览')} />
        <Skeleton rows={5} />
      </div>
    );
  }

  const d = data || {};
  const useTime = na(d.avg_use_time_sec, t(' 秒'), t('暂无数据'));
  const frt = na(d.avg_first_token_ms, ' ms', t('没有流式请求，无法统计'));
  const cache = na(d.cache_ratio_pct, '%', t('暂无数据'));
  const fail = d.error_log_enabled
    ? na(d.fail_ratio_pct, '%', t('暂无数据'))
    : { value: t('未开启错误日志'), unavailable: true };

  return (
    <div>
      <PageHead title={t('概览')} sub={t('你自己的调用情况')} />

      {staleAt ? (
        <p className='pt-stale'>
          {t('刷新失败，下面是上一次成功取到的数据。')}
          <button type='button' className='pt-linkbtn' onClick={load}>
            {t('重试')}
          </button>
        </p>
      ) : null}

      <div className='pt-filters'>
        {/* 时间范围是分段选择，不是主按钮——它借用 primary 当选中态，
            主按钮一改成主题色，这排就跟着变成了实心靛蓝，而别的页面同类筛选
            还是墨黑 chip。统一用 chip。 */}
        <RangeFilter value={range} onChange={(v) => patch(v)} />
        {loading ? (
          <span style={{ fontSize: 12, color: 'var(--pt-text-muted)' }}>
            {t('加载中…')}
          </span>
        ) : null}
      </div>

      <div className='pt-stat-grid'>
        <Stat label={t('请求数')} value={fmtInt(d.requests)} />
        <Stat label={t('Token 总量')} value={fmtCompact(d.tokens)} />
        <Stat
          label={t('输入 / 输出')}
          value={`${fmtCompact(d.prompt_tokens)} / ${fmtCompact(d.completion_tokens)}`}
        />
        <Stat
          label={t('累计 Token')}
          value={fmtCompact(d.lifetime_tokens)}
          hint={
            d.lifetime_requests
              ? `${fmtInt(d.lifetime_requests)} ${t('次调用')}`
              : undefined
          }
        />
      </div>

      <div className='pt-section'>
        <h2 className='pt-section-title'>{t('质量指标')}</h2>
        <p className='pt-section-sub'>
          {t('这段时间的实际表现；样本太少时会标明，不会拿 0 充数')}
        </p>
        <div className='pt-stat-grid' style={{ marginBottom: 0 }}>
          {/* P95 跟平均值放一起：单看平均会把长尾藏起来，
              10 次里 9 次 2 秒、1 次 40 秒，平均 5.8 秒看着挺好。 */}
          <Stat
            label={t('平均耗时')}
            {...useTime}
            hint={tailHint(
              d.p95_use_time_sec,
              t(' 秒'),
              d.use_time_samples,
              t('次'),
            )}
          />
          <Stat
            label={t('首字延迟')}
            {...frt}
            hint={tailHint(
              d.p95_first_token_ms,
              ' ms',
              d.stream_samples,
              t('次流式'),
            )}
          />
          <Stat
            label={t('客户端断开')}
            value={fmtInt(d.client_gone)}
            hint={t('记为成功，不计入失败')}
          />
          <Stat
            label={t('缓存输入占比')}
            {...cache}
            hint={t('命中缓存的输入 Token 占比')}
          />
          {SHOW_FAIL_RATE ? (
            <Stat
              label={t('上游调用失败比例')}
              {...fail}
              hint={
                d.error_log_enabled
                  ? `${fmtInt(d.failed)} / ${fmtInt(d.fail_denom)}`
                  : t('需管理员开启')
              }
            />
          ) : null}
        </div>
      </div>

      {/* 分布和趋势并排：一个回答「用了哪些模型」，一个回答「什么时候用的」，
          放一起互相对照。窄屏自动落回上下排列。 */}
      <div className='pt-two-col'>
        <div className='pt-section'>
          <h2 className='pt-section-title'>{t('模型分布')}</h2>
          <p className='pt-section-sub'>{t('按请求数，取前 6 个')}</p>
          <Card>
            {(d.models || []).length === 0 ? (
              <Empty text={t('这段时间还没有调用记录')} />
            ) : (
              <div className='pt-dist'>
                <div className='pt-dist-chart'>
                  <VChart spec={pieSpec} option={{ mode: 'desktop-browser' }} />
                </div>
                {/* 色点直接放在表格里，替掉环图右边那份独立图例——
                  两者列的是同一批模型名，并排时白占掉一百多像素，
                  挤得 Token 那列都显示不全。 */}
                <div className='pt-table-wrap'>
                  <table className='pt-table'>
                    <thead>
                      <tr>
                        <th>{t('模型')}</th>
                        <th className='pt-num'>{t('请求')}</th>
                        <th className='pt-num'>{t('占比')}</th>
                        <th className='pt-num'>Token</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(d.models || []).slice(0, 6).map((m, i) => (
                        <tr key={m.model_name}>
                          <td>
                            <span className='pt-dist-name'>
                              <i
                                className='pt-dot'
                                style={{
                                  background: PIE_COLORS[i % PIE_COLORS.length],
                                }}
                                aria-hidden='true'
                              />
                              <span className='pt-mono'>{m.model_name}</span>
                            </span>
                          </td>
                          <td className='pt-num'>{fmtInt(m.requests)}</td>
                          <td className='pt-num'>
                            {d.requests
                              ? ((m.requests / d.requests) * 100).toFixed(1)
                              : '0.0'}
                            %
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
        <div className='pt-section'>
          <div className='pt-section-head'>
            <h2 className='pt-section-title'>{t('调用趋势')}</h2>
            {/* 请求数和 Token 是两个口径：请求多不等于烧得多，
              一次长上下文调用抵得上几十次短问答。两个都得能看。 */}
            <div className='pt-chips'>
              {TREND_METRICS.map((x) => (
                <button
                  key={x.key}
                  type='button'
                  className={`pt-chip${trend === x.key ? ' on' : ''}`}
                  aria-pressed={trend === x.key}
                  onClick={() => setTrend(x.key)}
                >
                  {t(x.label)}
                </button>
              ))}
            </div>
          </div>
          <Card>
            {(d.series || []).some((p) => p.requests > 0) ? (
              <div className='pt-trend-chart'>
                <VChart spec={lineSpec} option={{ mode: 'desktop-browser' }} />
              </div>
            ) : (
              <Empty text={t('这段时间还没有调用记录')} />
            )}
          </Card>
        </div>
      </div>

      {recent.length ? (
        <div className='pt-section'>
          <div className='pt-section-head'>
            <h2 className='pt-section-title'>{t('最近调用')}</h2>
            <Link className='pt-linkbtn' to='/console/log'>
              {t('查看全部')}
            </Link>
          </div>
          <Card>
            <div className='pt-wide-only'>
              <ChatTable
                rows={recent}
                openId={openErr}
                onToggleErr={(id) => setOpenErr(openErr === id ? null : id)}
              />
            </div>
            <div className='pt-narrow-only'>
              <ChatCards rows={recent} />
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
