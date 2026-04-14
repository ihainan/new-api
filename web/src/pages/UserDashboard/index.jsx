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

import React, { useEffect, useState, useCallback } from 'react';
import { Card, Table, Skeleton, Typography } from '@douyinfe/semi-ui';
import { VChart } from '@visactor/react-vchart';
import { initVChartSemiTheme } from '@visactor/vchart-semi-theme';
import { API } from '../../helpers';
import { renderNumber, modelColorMap, modelToColor } from '../../helpers/render.jsx';
import { timestamp2string } from '../../helpers/utils.jsx';

const { Text } = Typography;

/* ─── 颜色工具 ─── */
const getModelColor = (model, cache) => {
  if (cache[model]) return cache[model];
  const color = modelColorMap[model] || modelToColor(model);
  cache[model] = color;
  return color;
};

/* ─── Unix 时间戳（秒）→ YYYY-MM-DD ─── */
const tsToDate = (ts) => {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* ─── 聚合 QuotaData 数组 → { tokens, requests } ─── */
const sumData = (data) => {
  let tokens = 0, requests = 0;
  (data || []).forEach((item) => {
    tokens   += item.token_used || 0;
    requests += item.count      || 0;
  });
  return { tokens, requests };
};

const CHART_CONFIG = { mode: 'desktop-browser' };

/* ─── 单个统计卡片 ─── */
const StatCard = ({ label, value, loading, icon, gradient }) => (
  <Card
    shadows=''
    bordered
    headerLine={false}
    style={{ borderRadius: '16px', flex: '1 1 0', minWidth: 0 }}
    bodyStyle={{ padding: '18px 20px' }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
      <div style={{
        width: 40, height: 40, borderRadius: '10px',
        background: gradient,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '11px', color: 'rgba(0,0,0,0.4)', marginBottom: '3px', whiteSpace: 'nowrap' }}>
          {label}
        </div>
        <div style={{ fontSize: '22px', fontWeight: 700, lineHeight: 1.2 }}>
          {loading
            ? <Skeleton.Paragraph active rows={1} style={{ width: '80px', height: '24px', marginTop: '2px' }} />
            : <span>{value ?? '—'}</span>
          }
        </div>
      </div>
    </div>
  </Card>
);

/* ─── 图标 SVG ─── */
const IconToken = () => (
  <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
    <polyline points='22 12 18 12 15 21 9 3 6 12 2 12' />
  </svg>
);
const IconRequest = () => (
  <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
    <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' />
  </svg>
);

const UserDashboard = () => {
  /* ─── 四个统计数值 ─── */
  const [stats, setStats] = useState({ tokens7d: null, tokens1d: null, req7d: null, req1d: null });
  const [statsLoading, setStatsLoading] = useState(true);

  /* ─── 图表 ─── */
  const [chartSpec, setChartSpec] = useState(null);
  const [chartLoading, setChartLoading] = useState(true);

  /* ─── 最近请求 ─── */
  const [recentLogs, setRecentLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);

  /* ─── 初始化 VChart Semi 主题 ─── */
  useEffect(() => {
    initVChartSemiTheme({ isWatchingThemeSwitch: true });
  }, []);

  /* ─── 加载统计卡片数据（1d + 7d 并发） ─── */
  const loadStats = useCallback(async () => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const [res7d, res1d] = await Promise.all([
        API.get(`/api/data/self?start_timestamp=${now - 86400 * 7}&end_timestamp=${now}`),
        API.get(`/api/data/self?start_timestamp=${now - 86400 * 1}&end_timestamp=${now}`),
      ]);
      const data7d = res7d.data.success ? res7d.data.data : [];
      const data1d = res1d.data.success ? res1d.data.data : [];
      const s7 = sumData(data7d);
      const s1 = sumData(data1d);
      setStats({
        tokens7d: renderNumber(s7.tokens),
        tokens1d: renderNumber(s1.tokens),
        req7d:    renderNumber(s7.requests),
        req1d:    renderNumber(s1.requests),
      });
    } catch (e) {
      console.error('Failed to load stats', e);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  /* ─── 加载图表数据（7 天，补全每天） ─── */
  const loadChart = useCallback(async () => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const res = await API.get(
        `/api/data/self?start_timestamp=${now - 86400 * 7}&end_timestamp=${now}`,
      );
      const { success, data } = res.data;
      if (!success || !data) return;

      const colorCache = {};
      const modelSet   = new Set();

      // 生成完整 7 天日期列表
      const allDates = [];
      for (let i = 6; i >= 0; i--) allDates.push(tsToDate(now - 86400 * i));

      // dateModelMap[date][model] = tokens
      const dateModelMap = {};
      allDates.forEach((d) => { dateModelMap[d] = {}; });

      data.forEach((item) => {
        const date  = tsToDate(item.created_at);
        const model = item.model_name || 'unknown';
        const tokens = item.token_used || 0;
        modelSet.add(model);
        if (!dateModelMap[date]) dateModelMap[date] = {};
        dateModelMap[date][model] = (dateModelMap[date][model] || 0) + tokens;
      });

      const models = Array.from(modelSet);
      const specifiedColors = {};
      models.forEach((m) => { specifiedColors[m] = getModelColor(m, colorCache); });

      // 若无任何模型（全空），插一个占位条保证 7 天轴都显示
      const barValues = [];
      if (models.length === 0) {
        allDates.forEach((date) => barValues.push({ date, model: '', tokens: 0 }));
      } else {
        allDates.forEach((date) => {
          models.forEach((model) => {
            barValues.push({ date, model, tokens: dateModelMap[date][model] || 0 });
          });
        });
      }

      const total7d = data.reduce((s, i) => s + (i.token_used || 0), 0);

      setChartSpec({
        type: 'bar',
        data: [{ id: 'tokenData', values: barValues }],
        xField: 'date',
        yField: 'tokens',
        seriesField: 'model',
        stack: true,
        legends: { visible: models.length > 0, selectMode: 'single' },
        title: {
          visible: true,
          text: '近 7 天每日 Token 消耗',
          subtext: `总计：${renderNumber(total7d)} tokens`,
        },
        bar: { state: { hover: { stroke: '#000', lineWidth: 1 } } },
        axes: [
          {
            orient: 'bottom',
            type: 'band',
            domain: allDates,   // 强制显示完整 7 天
          },
        ],
        tooltip: {
          mark: {
            content: [{ key: (d) => d['model'], value: (d) => renderNumber(d['tokens']) }],
          },
          dimension: {
            content: [{ key: (d) => d['model'], value: (d) => d['tokens'] || 0 }],
            updateContent: (array) => {
              array.sort((a, b) => b.value - a.value);
              let sum = 0;
              array.forEach((item) => {
                const v = parseFloat(item.value) || 0;
                sum += v;
                item.value = renderNumber(v);
              });
              array.unshift({ key: '总计', value: renderNumber(sum) });
              return array;
            },
          },
        },
        color: { specified: specifiedColors },
      });
    } catch (e) {
      console.error('Failed to load chart data', e);
    } finally {
      setChartLoading(false);
    }
  }, []);

  /* ─── 加载最近 10 次消费请求 ─── */
  const loadRecentLogs = useCallback(async () => {
    try {
      const res = await API.get('/api/log/self?p=1&page_size=10&type=2');
      const { success, data } = res.data;
      if (!success || !data) return;
      setRecentLogs(data.items || []);
    } catch (e) {
      console.error('Failed to load recent logs', e);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadChart();
    loadRecentLogs();
  }, [loadStats, loadChart, loadRecentLogs]);

  /* ─── 表格列定义 ─── */
  const columns = [
    {
      title: '请求时间',
      dataIndex: 'created_at',
      render: (val) => <Text size='small' type='tertiary'>{timestamp2string(val)}</Text>,
    },
    {
      title: '模型',
      dataIndex: 'model_name',
      render: (val) => <Text size='small' style={{ fontFamily: 'monospace' }}>{val || '-'}</Text>,
    },
    {
      title: 'Token 消耗',
      dataIndex: 'token_used',
      render: (_, row) => {
        const total = (row.prompt_tokens || 0) + (row.completion_tokens || 0);
        return (
          <Text size='small'>
            {renderNumber(total)}
            <Text size='small' type='tertiary' style={{ marginLeft: 4 }}>
              ({row.prompt_tokens || 0} + {row.completion_tokens || 0})
            </Text>
          </Text>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>

      {/* ── 四个统计卡片 ── */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <StatCard
          label='今日 Token 消耗'
          value={stats.tokens1d}
          loading={statsLoading}
          gradient='linear-gradient(135deg, #1677ff 0%, #5b2be9 100%)'
          icon={<IconToken />}
        />
        <StatCard
          label='7 天 Token 消耗'
          value={stats.tokens7d}
          loading={statsLoading}
          gradient='linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
          icon={<IconToken />}
        />
        <StatCard
          label='今日 Requests'
          value={stats.req1d}
          loading={statsLoading}
          gradient='linear-gradient(135deg, #0891b2 0%, #0e7490 100%)'
          icon={<IconRequest />}
        />
        <StatCard
          label='7 天 Requests'
          value={stats.req7d}
          loading={statsLoading}
          gradient='linear-gradient(135deg, #059669 0%, #047857 100%)'
          icon={<IconRequest />}
        />
      </div>

      {/* ── 每日 Token 消耗图表 ── */}
      <Card
        shadows=''
        bordered
        headerLine
        title='近 7 天每日 Token 消耗（按模型区分）'
        style={{ borderRadius: '16px', marginBottom: '20px' }}
        bodyStyle={{ padding: '8px' }}
      >
        {chartLoading ? (
          <div style={{ height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Skeleton.Paragraph active rows={6} style={{ width: '90%' }} />
          </div>
        ) : (
          <div style={{ height: '320px' }}>
            <VChart spec={chartSpec || { type: 'bar', data: [{ id: 'd', values: [] }], xField: 'x', yField: 'y' }} option={CHART_CONFIG} />
          </div>
        )}
      </Card>

      {/* ── 最近 10 次请求 ── */}
      <Card
        shadows=''
        bordered
        headerLine
        title='最近 10 次请求'
        style={{ borderRadius: '16px' }}
        bodyStyle={{ padding: '0' }}
      >
        <Table
          columns={columns}
          dataSource={recentLogs}
          loading={logsLoading}
          pagination={false}
          rowKey='id'
          size='small'
          empty={
            <div style={{ padding: '40px 0', color: 'rgba(0,0,0,0.35)', textAlign: 'center' }}>
              暂无请求记录
            </div>
          }
        />
      </Card>

    </div>
  );
};

export default UserDashboard;
