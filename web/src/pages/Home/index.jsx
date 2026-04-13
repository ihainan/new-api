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

import React, { useContext } from 'react';
import { Button, Typography, Tag } from '@douyinfe/semi-ui';
import { Link, useNavigate } from 'react-router-dom';
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

const { Title, Text } = Typography;

// 代码示例片段（仿 AIHubMix 卡片2）
const CODE_SNIPPET = `from openai import OpenAI

client = OpenAI(
  api_key="sk-***",
  base_url="https://your-gateway/v1"
)

response = client.chat.completions.create(
  model="gpt-4o",
  messages=[{"role": "user",
    "content": "Hello!"}]
)`;

const PROVIDER_ICONS = [
  { key: 'moonshot', el: <Moonshot size={36} /> },
  { key: 'openai', el: <OpenAI size={36} /> },
  { key: 'xai', el: <XAI size={36} /> },
  { key: 'zhipu', el: <Zhipu.Color size={36} /> },
  { key: 'volcengine', el: <Volcengine.Color size={36} /> },
  { key: 'cohere', el: <Cohere.Color size={36} /> },
  { key: 'claude', el: <Claude.Color size={36} /> },
  { key: 'gemini', el: <Gemini.Color size={36} /> },
  { key: 'suno', el: <Suno size={36} /> },
  { key: 'minimax', el: <Minimax.Color size={36} /> },
  { key: 'wenxin', el: <Wenxin.Color size={36} /> },
  { key: 'spark', el: <Spark.Color size={36} /> },
  { key: 'qingyan', el: <Qingyan.Color size={36} /> },
  { key: 'deepseek', el: <DeepSeek.Color size={36} /> },
  { key: 'qwen', el: <Qwen.Color size={36} /> },
  { key: 'midjourney', el: <Midjourney size={36} /> },
  { key: 'grok', el: <Grok size={36} /> },
  { key: 'azure', el: <AzureAI.Color size={36} /> },
  { key: 'hunyuan', el: <Hunyuan.Color size={36} /> },
  { key: 'xinference', el: <Xinference.Color size={36} /> },
];

const Home = () => {
  const [statusState] = useContext(StatusContext);
  const navigate = useNavigate();
  const docsLink = statusState?.status?.docs_link || '';
  const isLoggedIn = !!localStorage.getItem('user');

  const handleGetKey = () => {
    if (isLoggedIn) {
      navigate('/console/token');
    } else {
      navigate('/login');
    }
  };

  return (
    <div style={{ width: '100%', overflowX: 'hidden' }}>
      {/* ── Hero 区域（深色背景） ── */}
      <section
        style={{
          background: 'linear-gradient(180deg, #0a0a0f 0%, #0f1020 100%)',
          minHeight: '680px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: '80px',
          paddingBottom: '80px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 背景装饰光晕 */}
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '15%',
            width: '400px',
            height: '400px',
            background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '30%',
            right: '10%',
            width: '300px',
            height: '300px',
            background: 'radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* 居中内容 */}
        <div
          style={{
            textAlign: 'center',
            maxWidth: '800px',
            padding: '0 24px',
            zIndex: 1,
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(40px, 7vw, 72px)',
              fontWeight: 800,
              lineHeight: 1.1,
              margin: '0 0 24px 0',
              background: 'linear-gradient(135deg, #ffffff 0%, #a5b4fc 50%, #67e8f9 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            One Gateway,<br />Infinite Models
          </h1>
          <p
            style={{
              fontSize: '18px',
              color: 'rgba(255,255,255,0.65)',
              margin: '0 0 40px 0',
              lineHeight: 1.6,
            }}
          >
            Access every major LLM through a single, unified interface.<br />
            Build smarter, faster.
          </p>

          {/* CTA 按钮 */}
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {docsLink && (
              <Button
                size='large'
                style={{
                  borderRadius: '999px',
                  padding: '0 32px',
                  height: '48px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontSize: '16px',
                }}
                onClick={() => window.open(docsLink, '_blank')}
              >
                Docs
              </Button>
            )}
            <Button
              size='large'
              theme='solid'
              type='primary'
              style={{
                borderRadius: '999px',
                padding: '0 32px',
                height: '48px',
                fontSize: '16px',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                border: 'none',
              }}
              onClick={handleGetKey}
            >
              Get API Key →
            </Button>
          </div>
        </div>
      </section>

      {/* ── 特性卡片区（浅色背景） ── */}
      <section
        style={{
          background: '#f8fafc',
          padding: '80px 24px',
        }}
      >
        <div
          style={{
            maxWidth: '1100px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px',
          }}
        >
          {/* 卡片1：Full Model Coverage */}
          <div
            style={{
              background: '#fff',
              borderRadius: '20px',
              border: '1px solid #e8ecf0',
              padding: '32px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            }}
          >
            <Title heading={5} style={{ marginBottom: '8px', color: '#1a1a2e' }}>
              Full Model Coverage
            </Title>
            <Text type='tertiary' style={{ fontSize: '13px', display: 'block', marginBottom: '24px' }}>
              Access 30+ top AI providers in one place
            </Text>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                alignItems: 'center',
              }}
            >
              {PROVIDER_ICONS.slice(0, 12).map(({ key, el }) => (
                <div
                  key={key}
                  style={{
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {el}
                </div>
              ))}
              <Text strong style={{ fontSize: '18px', color: '#6366f1' }}>30+</Text>
            </div>
            <div style={{ marginTop: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['Chat', 'Embedding', 'Image', 'Audio', 'Video'].map((tag) => (
                <Tag
                  key={tag}
                  style={{
                    borderRadius: '999px',
                    background: '#f1f5ff',
                    color: '#6366f1',
                    border: 'none',
                    fontSize: '12px',
                  }}
                >
                  {tag}
                </Tag>
              ))}
            </div>
          </div>

          {/* 卡片2：Unified API */}
          <div
            style={{
              background: '#0f1117',
              borderRadius: '20px',
              border: '1px solid #1e2130',
              padding: '32px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
            }}
          >
            <Title heading={5} style={{ marginBottom: '8px', color: '#fff' }}>
              Unified API, Flexible Model Choice
            </Title>
            <Text style={{ fontSize: '13px', display: 'block', marginBottom: '20px', color: 'rgba(255,255,255,0.5)' }}>
              OpenAI-compatible interface, switch models with one line
            </Text>
            <pre
              style={{
                background: '#1a1d2e',
                borderRadius: '12px',
                padding: '16px',
                fontSize: '12px',
                lineHeight: 1.7,
                color: '#a5b4fc',
                overflow: 'auto',
                margin: 0,
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              }}
            >
              <span style={{ color: '#f472b6' }}>{'from '}</span>
              <span style={{ color: '#67e8f9' }}>{'openai'}</span>
              <span style={{ color: '#f472b6' }}>{' import '}</span>
              <span style={{ color: '#fff' }}>{'OpenAI'}</span>
              {'\n\n'}
              <span style={{ color: '#94a3b8' }}>{'client = OpenAI('}</span>
              {'\n'}
              <span style={{ color: '#94a3b8' }}>{'  api_key='}</span>
              <span style={{ color: '#86efac' }}>{'"sk-***"'}</span>
              <span style={{ color: '#94a3b8' }}>{','}</span>
              {'\n'}
              <span style={{ color: '#94a3b8' }}>{'  base_url='}</span>
              <span style={{ color: '#86efac' }}>{'"https://your-gw/v1"'}</span>
              {'\n'}
              <span style={{ color: '#94a3b8' }}>{')'}</span>
              {'\n\n'}
              <span style={{ color: '#94a3b8' }}>{'response = client.chat'}</span>
              {'\n'}
              <span style={{ color: '#94a3b8' }}>{'  .completions.create('}</span>
              {'\n'}
              <span style={{ color: '#94a3b8' }}>{'    model='}</span>
              <span style={{ color: '#86efac' }}>{'"gpt-4o"'}</span>
              {'\n'}
              <span style={{ color: '#94a3b8' }}>{'  )'}</span>
            </pre>
          </div>

          {/* 卡片3：Boundless Concurrency */}
          <div
            style={{
              background: '#fff',
              borderRadius: '20px',
              border: '1px solid #e8ecf0',
              padding: '32px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            }}
          >
            <Title heading={5} style={{ marginBottom: '8px', color: '#1a1a2e' }}>
              Boundless Concurrency, Always-On
            </Title>
            <Text type='tertiary' style={{ fontSize: '13px', display: 'block', marginBottom: '24px' }}>
              High availability with intelligent load balancing
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { label: 'Uptime', value: '99.9%', color: '#22c55e' },
                { label: 'Avg Latency', value: '< 200ms', color: '#6366f1' },
                { label: 'Requests/day', value: '10M+', color: '#f59e0b' },
                { label: 'Channels', value: '100+', color: '#14b8a6' },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: '#f8fafc',
                    borderRadius: '12px',
                  }}
                >
                  <Text type='tertiary' style={{ fontSize: '14px' }}>{label}</Text>
                  <Text strong style={{ fontSize: '18px', color }}>{value}</Text>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          background: '#0a0a0f',
          color: 'rgba(255,255,255,0.4)',
          textAlign: 'center',
          padding: '32px 24px',
          fontSize: '13px',
        }}
      >
        <div style={{ marginBottom: '8px' }}>
          {statusState?.status?.system_name || 'AI Gateway'} · Powered by New API
        </div>
        <div>© {new Date().getFullYear()} All rights reserved.</div>
      </footer>
    </div>
  );
};

export default Home;
