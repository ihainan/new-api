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

import React, { useState, useEffect } from 'react';
import { Button } from '@douyinfe/semi-ui';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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
          margin: '0 0 20px 0',
          letterSpacing: '0.15em',
          fontWeight: 400,
        }}>
          循此苦旅，以达繁星。
        </p>

        {/* API 地址展示 */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          background: 'rgba(22,119,255,0.05)',
          border: '1px solid rgba(22,119,255,0.14)',
          borderRadius: '10px',
          padding: '8px 18px',
          margin: '0 0 36px 0',
        }}>
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: '#1677ff',
            opacity: 0.7,
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: '"JetBrains Mono","Fira Code","Cascadia Code",monospace',
            fontSize: '13px',
            color: '#1677ff',
            letterSpacing: '0.02em',
            userSelect: 'all',
          }}>
            https://hub.zgci.org/v1/chat/completions
          </span>
        </div>

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

          {/* ── 卡片 1：Workbuddy Integration ── */}
          <a
            href='https://alidocs.dingtalk.com/i/nodes/gpG2NdyVX39REkvAcAkp1K1XWMwvDqPk?cid=5680627354:5772551890&rnd=0.22422060793007192&utm_source=im&utm_scene=person_space&iframeQuery=utm_medium%3Dportal_recent%26utm_source%3Dportal&utm_medium=im_card&dontjump=true&corpId=ding216d3a4e9fdd44cef5bf40eda33b7ba0'
            target='_blank'
            rel='noopener noreferrer'
            style={{
              ...cardBase,
              padding: 0,
              overflow: 'hidden',
              background: '#ffffff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'box-shadow 0.2s ease, transform 0.2s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = '0 8px 28px rgba(40,184,148,0.22)';
              e.currentTarget.style.transform = 'translateY(-3px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {/* ── Full-width banner ── */}
            <div style={{
              position: 'relative',
              height: '168px',
              background: 'linear-gradient(140deg, #16896a 0%, #22a882 35%, #28B894 65%, #36d4a8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {/* 背景装饰圆 */}
              <div style={{ position: 'absolute', width: '260px', height: '260px', borderRadius: '50%', background: 'rgba(255,255,255,0.055)', top: '-90px', right: '-60px', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(255,255,255,0.045)', bottom: '-60px', left: '-20px', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', width: '80px',  height: '80px',  borderRadius: '50%', background: 'rgba(255,255,255,0.06)',  top: '18px', left: '48px', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', width: '36px',  height: '36px',  borderRadius: '50%', background: 'rgba(255,255,255,0.08)',  bottom: '22px', right: '56px', pointerEvents: 'none' }} />

              {/* Workbuddy 角色 — 白色轮廓浮在 banner 上，放大 2.9× */}
              {/* 原始 viewBox 0 0 49 48；扩大到 -8 -6 66 60 以展示超出裁剪区的完整身体 */}
              <svg
                xmlns='http://www.w3.org/2000/svg'
                width='144'
                height='132'
                viewBox='-8 -4 66 58'
                fill='none'
                style={{
                  color: 'rgba(255,255,255,0.92)',
                  position: 'relative',
                  zIndex: 2,
                  filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.22))',
                }}
              >
                {/* 半透明圆角底板，让角色稍微浮起 */}
                <rect x='0.5' width='48' height='48' rx='10.3579' fill='rgba(255,255,255,0.13)' />
                {/* 主体路径 */}
                <path d='M37.2114 3.75318C37.6821 3.33106 37.7106 3.31457 38.0558 3.29385C38.6149 3.2531 39.1272 3.52199 39.9989 4.31564C42.0356 6.16652 44.8714 9.97183 46.6346 13.2212L47.3163 14.4819L48.2782 14.9605C49.2072 15.4299 50.7308 16.3923 51.3672 16.9085C51.655 17.1464 51.6956 17.1508 51.9947 17.0344C53.3454 16.5084 55.2803 17.206 56.9869 18.8432C58.5231 20.3155 59.9943 22.8312 60.558 24.9308C60.6403 25.2687 60.7493 25.9952 60.7891 26.5362C60.9177 28.4358 60.3092 29.9532 59.1362 30.64C58.8965 30.7784 58.8801 30.8158 58.8868 31.4132C58.9409 34.2583 58.1741 37.0985 56.6335 39.8679C54.8946 42.9773 51.7981 46.1938 47.6074 49.2243C45.357 50.8619 40.0323 53.964 37.6248 55.0532C31.8578 57.6496 27.2346 58.646 23.2188 58.154C20.8236 57.8638 18.1124 56.9287 16.5082 55.8433C16.086 55.5515 16.0191 55.5329 15.6966 55.6251C13.9793 56.1185 11.73 55.1053 9.81931 52.9844C9.05725 52.1366 7.82714 50.0548 7.42839 48.9409C6.50606 46.3339 6.68976 43.9816 7.91836 42.5767C8.23573 42.2149 8.2453 42.1995 8.17598 41.5912C8.06148 40.5951 8.00971 39.1206 8.06202 38.1692L8.10361 37.2803L6.76977 34.9212C4.70378 31.2451 3.3912 28.1582 2.88489 25.7998C2.61762 24.5066 2.63385 23.9324 2.96214 23.5078C3.16198 23.2515 3.81796 22.9866 4.60785 22.8407C6.59665 22.4917 10.9334 22.8076 15.7581 23.6595L16.259 23.7458L17.3608 22.7713C19.1891 21.1519 20.4038 20.244 22.6429 18.8478C24.9768 17.3876 27.6108 16.1858 30.577 15.2346L31.5295 14.9294L32.0526 13.5561C33.9257 8.61146 35.8437 4.96584 37.2114 3.75318ZM21.5208 29.0919C19.404 30.314 18.3453 30.9251 17.5676 31.6099C14.4179 34.3835 13.2414 38.777 14.5823 42.7537C14.9135 43.7357 15.5247 44.7942 16.7469 46.9111C17.9691 49.0279 18.5801 50.0865 19.2649 50.8643C22.0385 54.014 26.4316 55.1918 30.4084 53.8509C31.3904 53.5198 32.4489 52.9085 34.5657 51.6863L46.7442 44.6551C48.8613 43.4328 49.9205 42.8214 50.6983 42.1365C53.8479 39.363 55.0245 34.9695 53.6835 30.9927C53.3524 30.0107 52.7412 28.9522 51.519 26.8354C50.2968 24.7185 49.6858 23.66 49.0009 22.8822C46.2274 19.7325 41.8342 18.5547 37.8575 19.8956C36.8754 20.2267 35.8163 20.8383 33.6993 22.0606L21.5208 29.0919Z' fill='currentColor' />
                {/* 左眼 */}
                <g transform='rotate(-30 22.6953 37.6011)'>
                  <rect x='22.6953' y='37.6011' width='4.81084' height='9.99175' rx='2.40542' fill='currentColor' />
                </g>
                {/* 右眼 */}
                <g transform='rotate(-30 35.6748 30.1074)'>
                  <rect x='35.6748' y='30.1074' width='4.81084' height='9.99175' rx='2.40542' fill='currentColor' />
                </g>
              </svg>

              {/* 右下角品牌名 */}
              <div style={{
                position: 'absolute',
                bottom: '14px',
                right: '18px',
                fontSize: '10px',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.55)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}>
                Workbuddy
              </div>
            </div>

            {/* ── 卡片内容 ── */}
            <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ ...cardTitle, color: 'rgba(0,0,0,0.88)', marginBottom: '12px' }}>
                Integrate with Workbuddy
              </div>

              <p style={{ fontSize: '14px', color: 'rgba(0,0,0,0.55)', lineHeight: 1.7, margin: '0 0 20px 0', flex: 1 }}>
                <strong style={{ color: 'rgba(0,0,0,0.75)' }}>Bring AI to your team</strong> with Workbuddy.
                Connect Astra Gate's full model library to your workspace
                for <strong style={{ color: 'rgba(0,0,0,0.75)' }}>seamless AI conversations</strong> — right inside your daily workflow.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['All Models', 'Team Ready'].map(label => (
                    <span key={label} style={{
                      background: '#f0fdf9',
                      color: '#1a9e7a',
                      borderRadius: '999px',
                      padding: '3px 10px',
                      fontSize: '12px',
                      fontWeight: 500,
                      border: '1px solid rgba(40,184,148,0.2)',
                    }}>
                      {label}
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: '18px', color: '#28B894', fontWeight: 300, flexShrink: 0, marginLeft: '8px' }}>→</span>
              </div>
            </div>
          </a>

          {/* ── 卡片 2：ZGCI Skill Hub ── */}
          <a
            href='http://skills.zgci.org/'
            target='_blank'
            rel='noopener noreferrer'
            style={{
              ...cardBase,
              padding: 0,
              overflow: 'hidden',
              background: '#ffffff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'box-shadow 0.2s ease, transform 0.2s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = '0 8px 28px rgba(99,102,241,0.24)';
              e.currentTarget.style.transform = 'translateY(-3px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {/* ── Full-width banner ── */}
            <div style={{
              position: 'relative',
              height: '168px',
              background: 'linear-gradient(140deg, #1e1b4b 0%, #3730a3 35%, #4f46e5 65%, #6d6bf0 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {/* 背景装饰圆 */}
              <div style={{ position: 'absolute', width: '260px', height: '260px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', top: '-90px', right: '-60px', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', bottom: '-60px', left: '-20px', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', width: '80px',  height: '80px',  borderRadius: '50%', background: 'rgba(255,255,255,0.055)', top: '18px', left: '48px', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', width: '36px',  height: '36px',  borderRadius: '50%', background: 'rgba(255,255,255,0.07)',  bottom: '22px', right: '56px', pointerEvents: 'none' }} />

              {/* Skill Hub 图标：芯片主体 + 四向插件节点 */}
              <svg
                xmlns='http://www.w3.org/2000/svg'
                width='132'
                height='132'
                viewBox='-6 -6 60 60'
                fill='none'
                style={{
                  color: 'rgba(255,255,255,0.92)',
                  position: 'relative',
                  zIndex: 2,
                  filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.28))',
                }}
              >
                {/* 半透明背景圆 */}
                <circle cx='24' cy='24' r='26' fill='rgba(255,255,255,0.1)' />
                {/* 上方 skill 节点 */}
                <rect x='18' y='-1' width='12' height='7' rx='3.5' fill='currentColor' />
                {/* 下方 skill 节点 */}
                <rect x='18' y='42' width='12' height='7' rx='3.5' fill='currentColor' />
                {/* 左侧 skill 节点 */}
                <rect x='-1' y='18' width='7' height='12' rx='3.5' fill='currentColor' />
                {/* 右侧 skill 节点 */}
                <rect x='42' y='18' width='7' height='12' rx='3.5' fill='currentColor' />
                {/* 连接引脚 */}
                <rect x='22.5' y='6' width='3' height='6' rx='1.5' fill='currentColor' />
                <rect x='22.5' y='36' width='3' height='6' rx='1.5' fill='currentColor' />
                <rect x='6' y='22.5' width='6' height='3' rx='1.5' fill='currentColor' />
                <rect x='36' y='22.5' width='6' height='3' rx='1.5' fill='currentColor' />
                {/* 主芯片体 */}
                <rect x='12' y='12' width='24' height='24' rx='6' fill='currentColor' />
                {/* 芯片内窗 */}
                <rect x='16' y='16' width='16' height='16' rx='3' fill='rgba(0,0,0,0.22)' />
                {/* 闪电（能力/扩展象征） */}
                <path d='M25 17 L20 25 L23 25 L21 32 L28 24 L25 24 Z' fill='currentColor' />
                {/* 四角装饰点 */}
                <circle cx='8'  cy='8'  r='2.5' fill='currentColor' opacity='0.5' />
                <circle cx='40' cy='8'  r='2.5' fill='currentColor' opacity='0.5' />
                <circle cx='8'  cy='40' r='2.5' fill='currentColor' opacity='0.5' />
                <circle cx='40' cy='40' r='2.5' fill='currentColor' opacity='0.5' />
              </svg>

              {/* 右下角品牌名 */}
              <div style={{
                position: 'absolute',
                bottom: '14px',
                right: '18px',
                fontSize: '10px',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.55)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}>
                Skill Hub
              </div>
            </div>

            {/* ── 卡片内容 ── */}
            <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ ...cardTitle, color: 'rgba(0,0,0,0.88)', marginBottom: '12px' }}>
                ZGCI Agent Skill Hub
              </div>

              <p style={{ fontSize: '14px', color: 'rgba(0,0,0,0.55)', lineHeight: 1.7, margin: '0 0 20px 0', flex: 1 }}>
                Extend your AI agents with <strong style={{ color: 'rgba(0,0,0,0.75)' }}>ZGCI's self-built skills</strong>.
                Browse and integrate capabilities built for enterprise workflows —
                all from our <strong style={{ color: 'rgba(0,0,0,0.75)' }}>private, self-hosted skill registry</strong>.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['Self-hosted', 'ZGCI Skills', 'Agent Ready'].map(label => (
                    <span key={label} style={{
                      background: '#eef2ff',
                      color: '#4338ca',
                      borderRadius: '999px',
                      padding: '3px 10px',
                      fontSize: '12px',
                      fontWeight: 500,
                      border: '1px solid rgba(99,102,241,0.2)',
                    }}>
                      {label}
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: '18px', color: '#4f46e5', fontWeight: 300, flexShrink: 0, marginLeft: '8px' }}>→</span>
              </div>
            </div>
          </a>

          {/* ── 卡片 3：Internal Agent Platform (OpenClaw) ── */}
          <div style={{
            ...cardBase,
            padding: 0,
            overflow: 'hidden',
            background: '#ffffff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            {/* ── Full-width banner ── */}
            <div style={{
              position: 'relative',
              height: '168px',
              background: 'linear-gradient(140deg, #7f1d1d 0%, #b91c1c 40%, #e81b25 70%, #f87171 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {/* 背景装饰圆 */}
              <div style={{ position: 'absolute', width: '260px', height: '260px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', top: '-90px', right: '-60px', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', bottom: '-60px', left: '-20px', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', width: '80px',  height: '80px',  borderRadius: '50%', background: 'rgba(255,255,255,0.055)', top: '18px', left: '48px', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', width: '36px',  height: '36px',  borderRadius: '50%', background: 'rgba(255,255,255,0.07)',  bottom: '22px', right: '56px', pointerEvents: 'none' }} />

              {/* OpenClaw 图标：三爪 + 掌垫 */}
              <svg
                xmlns='http://www.w3.org/2000/svg'
                width='132'
                height='132'
                viewBox='-6 -6 60 60'
                fill='none'
                style={{
                  color: 'rgba(255,255,255,0.92)',
                  position: 'relative',
                  zIndex: 2,
                  filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.28))',
                }}
              >
                {/* 半透明背景圆 */}
                <circle cx='24' cy='24' r='26' fill='rgba(255,255,255,0.1)' />
                {/* 左爪（绕爪根旋转 -26°） */}
                <path d='M22,24 C21,16 21,10 24,4 C27,10 27,16 26,24 Z' transform='rotate(-26 24 24)' fill='currentColor' />
                {/* 中爪 */}
                <path d='M22,24 C21,16 21,10 24,4 C27,10 27,16 26,24 Z' fill='currentColor' />
                {/* 右爪（绕爪根旋转 +26°） */}
                <path d='M22,24 C21,16 21,10 24,4 C27,10 27,16 26,24 Z' transform='rotate(26 24 24)' fill='currentColor' />
                {/* 掌垫 */}
                <ellipse cx='24' cy='32' rx='11' ry='9' fill='currentColor' />
                {/* 掌垫内圆（深色，增加立体感） */}
                <ellipse cx='24' cy='32' rx='6' ry='5' fill='rgba(0,0,0,0.2)' />
                {/* 四角装饰点 */}
                <circle cx='8'  cy='8'  r='2' fill='currentColor' opacity='0.45' />
                <circle cx='40' cy='8'  r='2' fill='currentColor' opacity='0.45' />
                <circle cx='8'  cy='40' r='2' fill='currentColor' opacity='0.45' />
                <circle cx='40' cy='40' r='2' fill='currentColor' opacity='0.45' />
              </svg>

              {/* 右下角品牌名 */}
              <div style={{
                position: 'absolute',
                bottom: '14px',
                right: '18px',
                fontSize: '10px',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.55)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}>
                OpenClaw
              </div>
            </div>

            {/* ── 卡片内容 ── */}
            <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ ...cardTitle, color: 'rgba(0,0,0,0.88)', marginBottom: 0, flex: 1 }}>
                  Internal Agent Platform
                </div>
                <span style={{
                  background: '#fff7ed',
                  color: '#c2410c',
                  borderRadius: '999px',
                  padding: '2px 9px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: '1px solid rgba(234,88,12,0.22)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}>
                  Coming Soon
                </span>
              </div>

              <p style={{ fontSize: '14px', color: 'rgba(0,0,0,0.55)', lineHeight: 1.7, margin: '0 0 20px 0', flex: 1 }}>
                Manage <strong style={{ color: 'rgba(0,0,0,0.75)' }}>OpenClaw &amp; Hermes Agent</strong> environments in one place.
                Monitor agent status, chat with agents, and visually manage workspace files —
                with <strong style={{ color: 'rgba(0,0,0,0.75)' }}>zero-config Astra Gate integration</strong>.
              </p>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['OpenClaw', 'Hermes Agent', 'Auto-connected'].map(label => (
                  <span key={label} style={{
                    background: '#fff1f2',
                    color: '#be123c',
                    borderRadius: '999px',
                    padding: '3px 10px',
                    fontSize: '12px',
                    fontWeight: 500,
                    border: '1px solid rgba(239,68,68,0.18)',
                  }}>
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
};

export default Home;
