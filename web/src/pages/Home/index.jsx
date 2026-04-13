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

import React, { useContext, useState, useEffect } from 'react';
import { Button } from '@douyinfe/semi-ui';
import { useNavigate } from 'react-router-dom';
import { StatusContext } from '../../context/Status';
import {
  Moonshot,
  OpenAI,
  XAI,
  Zhipu,
  Volcengine,
  Cohere,
  Claude,
  Gemini,
  Suno,
  Minimax,
  Wenxin,
  Spark,
  Qingyan,
  DeepSeek,
  Qwen,
  Midjourney,
  Grok,
  AzureAI,
  Hunyuan,
  Xinference,
} from '@lobehub/icons';

/* ─── 供应商图标列表 ─── */
const PROVIDER_ICONS = [
  { key: 'openai', el: <OpenAI size={32} /> },
  { key: 'claude', el: <Claude.Color size={32} /> },
  { key: 'gemini', el: <Gemini.Color size={32} /> },
  { key: 'deepseek', el: <DeepSeek.Color size={32} /> },
  { key: 'qwen', el: <Qwen.Color size={32} /> },
  { key: 'zhipu', el: <Zhipu.Color size={32} /> },
  { key: 'moonshot', el: <Moonshot size={32} /> },
  { key: 'grok', el: <Grok size={32} /> },
  { key: 'xai', el: <XAI size={32} /> },
  { key: 'volcengine', el: <Volcengine.Color size={32} /> },
  { key: 'cohere', el: <Cohere.Color size={32} /> },
  { key: 'azure', el: <AzureAI.Color size={32} /> },
  { key: 'minimax', el: <Minimax.Color size={32} /> },
  { key: 'wenxin', el: <Wenxin.Color size={32} /> },
  { key: 'spark', el: <Spark.Color size={32} /> },
  { key: 'qingyan', el: <Qingyan.Color size={32} /> },
  { key: 'suno', el: <Suno size={32} /> },
  { key: 'midjourney', el: <Midjourney size={32} /> },
  { key: 'hunyuan', el: <Hunyuan.Color size={32} /> },
  { key: 'xinference', el: <Xinference.Color size={32} /> },
];

/* ─── 代码行组件 ─── */
const CodeLine = ({ indent = 0, children }) => (
  <div style={{ paddingLeft: indent * 16, lineHeight: '1.8', fontFamily: '"JetBrains Mono","Fira Code","Cascadia Code",monospace', fontSize: '12.5px' }}>
    {children}
  </div>
);
const C = ({ color, children }) => <span style={{ color }}>{children}</span>;

/* ─── 卡片容器样式 ─── */
const cardBase = {
  borderRadius: '16px',
  border: '1px solid rgba(5,5,5,0.08)',
  padding: '24px',
  flex: '1 1 0',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  minHeight: '320px',
};

const cardTitle = {
  fontSize: '15px',
  fontWeight: 600,
  marginBottom: '20px',
  letterSpacing: '-0.01em',
};

/* ─── 主组件 ─── */
const Home = () => {
  const [statusState] = useContext(StatusContext);
  const navigate = useNavigate();
  const docsLink = statusState?.status?.docs_link || '';
  const systemName = statusState?.status?.system_name || 'AI Gateway';
  const isLoggedIn = !!localStorage.getItem('user');

  const [statIndex, setStatIndex] = useState(0);
  const stats = [
    { label: 'Uptime', value: '99.9%', sub: 'High availability' },
    { label: 'Channels', value: '100+', sub: 'Multi-provider routing' },
    { label: 'Latency', value: '< 200ms', sub: 'Global edge nodes' },
  ];
  useEffect(() => {
    const t = setInterval(() => setStatIndex(i => (i + 1) % stats.length), 2500);
    return () => clearInterval(t);
  }, []);

  const handleGetKey = () => navigate(isLoggedIn ? '/console/token' : '/login');

  return (
    <div style={{ width: '100%', overflowX: 'hidden', background: '#ffffff', fontFamily: 'Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif' }}>

      {/* ══════════════════════════════════════
          Hero 区域 — 白色背景，深色文字
      ══════════════════════════════════════ */}
      <section style={{
        background: '#ffffff',
        paddingTop: '64px',
        paddingBottom: '20px',
        paddingLeft: '24px',
        paddingRight: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}>

        {/* 大标题 */}
        <h1 style={{
          fontSize: 'clamp(32px, 5.5vw, 60px)',
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: '0.04em',
          fontStyle: 'italic',
          margin: '0 0 36px 0',
          maxWidth: '800px',
          background: 'linear-gradient(135deg, #1677ff 0%, #5b2be9 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          Per aspera ad astra
        </h1>

        {/* 副标题 */}
        <p style={{
          fontSize: '18px',
          color: 'rgba(0,0,0,0.4)',
          margin: '0 0 36px 0',
          letterSpacing: '0.15em',
          fontWeight: 400,
        }}>
          循此苦旅，以达繁星。
        </p>

      </section>

      {/* ══════════════════════════════════════
          三栏特性卡片
      ══════════════════════════════════════ */}
      <section style={{
        background: '#f5f5f7',
        padding: '32px 24px 56px',
      }}>
        <div style={{
          maxWidth: '1100px',
          margin: '0 auto',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
        }}>

          {/* ── 卡片 1：Full Model Coverage ── */}
          <div style={{ ...cardBase, background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={cardTitle}>Full Model Coverage</div>

            {/* 供应商图标网格 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
              {PROVIDER_ICONS.map(({ key, el }) => (
                <div key={key} style={{
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#f9f9fb',
                  borderRadius: '10px',
                  border: '1px solid rgba(0,0,0,0.06)',
                }}>
                  {el}
                </div>
              ))}
              <div style={{
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f0f5ff',
                borderRadius: '10px',
                border: '1px solid rgba(22,119,255,0.15)',
                fontSize: '13px',
                fontWeight: 700,
                color: '#1677ff',
              }}>
                30+
              </div>
            </div>

            {/* 类别标签 */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 'auto' }}>
              {[
                { label: 'Chat', color: '#f0f5ff', text: '#1677ff' },
                { label: 'Image Gen', color: '#fff7e6', text: '#d46b08' },
                { label: 'Embedding', color: '#f6ffed', text: '#389e0d' },
                { label: 'Audio', color: '#fff0f6', text: '#c41d7f' },
                { label: 'MCP', color: '#f9f0ff', text: '#531dab' },
              ].map(({ label, color, text }) => (
                <span key={label} style={{
                  background: color,
                  color: text,
                  borderRadius: '999px',
                  padding: '3px 10px',
                  fontSize: '12px',
                  fontWeight: 500,
                }}>
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* ── 卡片 2：Unified API（深色） ── */}
          <div style={{ ...cardBase, background: '#0f1117', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
            <div style={{ ...cardTitle, color: '#ffffff' }}>Unified API, Flexible Model Choice</div>

            {/* 语言选项卡 */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {['Python', 'cURL'].map((lang, i) => (
                <span key={lang} style={{
                  fontSize: '12px',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  background: i === 0 ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: i === 0 ? '#fff' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}>
                  {lang}
                </span>
              ))}
            </div>

            {/* 代码块 */}
            <div style={{
              background: '#1a1d2e',
              borderRadius: '12px',
              padding: '16px',
              flex: 1,
              overflow: 'hidden',
            }}>
              <CodeLine><C color='#c792ea'>from </C><C color='#82aaff'>openai</C><C color='#c792ea'> import </C><C color='#eeffff'>OpenAI</C></CodeLine>
              <CodeLine>&nbsp;</CodeLine>
              <CodeLine><C color='#eeffff'>client</C><C color='#89ddff'> = </C><C color='#eeffff'>OpenAI</C><C color='#89ddff'>{'('}</C></CodeLine>
              <CodeLine indent={1}><C color='#f07178'>api_key</C><C color='#89ddff'>=</C><C color='#c3e88d'>"sk-***"</C><C color='#89ddff'>,</C></CodeLine>
              <CodeLine indent={1}><C color='#f07178'>base_url</C><C color='#89ddff'>=</C><C color='#c3e88d'>"https://your-gw/v1"</C></CodeLine>
              <CodeLine><C color='#89ddff'>{')'}</C></CodeLine>
              <CodeLine>&nbsp;</CodeLine>
              <CodeLine><C color='#eeffff'>response</C><C color='#89ddff'> = </C><C color='#eeffff'>client</C><C color='#89ddff'>.</C><C color='#82aaff'>chat</C></CodeLine>
              <CodeLine indent={1}><C color='#89ddff'>.</C><C color='#82aaff'>completions</C><C color='#89ddff'>.</C><C color='#82aaff'>create</C><C color='#89ddff'>{'('}</C></CodeLine>
              <CodeLine indent={2}><C color='#f07178'>model</C><C color='#89ddff'>=</C><C color='#c3e88d'>"gpt-4o"</C><C color='#89ddff'>,</C></CodeLine>
              <CodeLine indent={2}><C color='#f07178'>messages</C><C color='#89ddff'>=[</C><C color='#89ddff'>{'{'}</C><C color='#c3e88d'>"role"</C><C color='#89ddff'>: </C><C color='#c3e88d'>"user"</C><C color='#89ddff'>, </C><C color='#c3e88d'>"content"</C><C color='#89ddff'>: </C><C color='#c3e88d'>"Hi!"</C><C color='#89ddff'>{'}'}</C><C color='#89ddff'>]</C></CodeLine>
              <CodeLine indent={1}><C color='#89ddff'>{')'}</C></CodeLine>
            </div>
          </div>

          {/* ── 卡片 3：Boundless Concurrency ── */}
          <div style={{ ...cardBase, background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={cardTitle}>Boundless Concurrency, Always-On</div>

            {/* 指标卡片列表 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
              {[
                { label: 'Uptime SLA', value: '99.9%', color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f' },
                { label: 'Avg Response', value: '< 200ms', color: '#1677ff', bg: '#e6f4ff', border: '#91caff' },
                { label: 'Requests / day', value: '10M+', color: '#722ed1', bg: '#f9f0ff', border: '#d3adf7' },
                { label: 'Active Channels', value: '100+', color: '#fa8c16', bg: '#fff7e6', border: '#ffd591' },
              ].map(({ label, value, color, bg, border }) => (
                <div key={label} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: bg,
                  border: `1px solid ${border}`,
                  borderRadius: '12px',
                }}>
                  <span style={{ fontSize: '13px', color: 'rgba(0,0,0,0.55)', fontWeight: 500 }}>{label}</span>
                  <span style={{ fontSize: '20px', fontWeight: 700, color, letterSpacing: '-0.02em' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* 轮播提示 */}
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <span style={{ fontSize: '12px', color: 'rgba(0,0,0,0.35)', background: '#f5f5f5', padding: '4px 12px', borderRadius: '999px' }}>
                Auto-failover · Load balancing · Multi-region
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════
          Footer
      ══════════════════════════════════════ */}
      <footer style={{
        background: '#fff',
        borderTop: '1px solid rgba(0,0,0,0.06)',
        padding: '24px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '13px', color: 'rgba(0,0,0,0.35)' }}>
          {systemName} · © {new Date().getFullYear()} All rights reserved.
        </span>
        {docsLink && (
          <a href={docsLink} target='_blank' rel='noopener noreferrer' style={{ fontSize: '13px', color: '#1677ff', textDecoration: 'none' }}>
            Documentation
          </a>
        )}
      </footer>
    </div>
  );
};

export default Home;
