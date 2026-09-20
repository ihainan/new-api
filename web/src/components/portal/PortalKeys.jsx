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
import {
  API,
  copy,
  getServerAddress,
  showError,
  showSuccess,
} from '../../helpers';
import { Card, CodeBlock, Empty, PageHead, Skeleton, Tabs, usePortalT } from './shared';

/*
 * API 密钥页。原来这里写的是「暂无 Key，请联系管理员分配 API Key」——
 * 那句话本身就是要消灭的申请环节。现在密钥直接可见可复制，下面配好接入代码。
 *
 * 明文不在列表接口里下发，只有用户主动点「显示」或「复制」时才向
 * POST /api/token/:id/key 取一次，那个接口带归属校验、限流和禁用缓存。
 */

const MASK = 'sk-••••••••••••••••••••••••••••••••';

// 接口返回的是裸 key，展示与复制统一补上 sk- 前缀：鉴权侧会 TrimPrefix，两种都能用，
// 但管理员界面和各家 SDK 的习惯都是带前缀，不该让员工看到两种形态。
const withPrefix = (k) => (!k || k.startsWith('sk-') ? k : `sk-${k}`);

const PROTOCOLS = [
  { key: 'openai', label: 'OpenAI 兼容' },
  { key: 'anthropic', label: 'Anthropic 兼容' },
];

export default function PortalKeys() {
  const t = usePortalT();
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);
  const [plain, setPlain] = useState('');
  const [busy, setBusy] = useState(false);
  const [proto, setProto] = useState('openai');
  const base = useMemo(() => getServerAddress(), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/token/?p=0&size=100');
      if (!res.data?.success) {
        showError(res.data?.message || t('获取密钥失败'));
        return;
      }
      const items = res.data.data?.items || [];
      // 员工只关心「我现在能用哪一把」：启用中的优先，同类里取最新。
      const usable = items.filter((it) => it.status === 1 && !it.deleted_at);
      setToken(
        (usable.length ? usable : items).sort(
          (a, b) => (b.created_time || 0) - (a.created_time || 0),
        )[0] || null,
      );
    } catch (e) {
      showError(t('获取密钥失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fetchPlain = async () => {
    const res = await API.post(`/api/token/${token.id}/key`);
    if (!res.data?.success)
      throw new Error(res.data?.message || t('获取密钥失败'));
    return withPrefix(res.data.data?.key || '');
  };

  const toggle = async () => {
    if (plain) {
      setPlain('');
      return;
    }
    setBusy(true);
    try {
      setPlain(await fetchPlain());
    } catch (e) {
      showError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const copyKey = async () => {
    setBusy(true);
    try {
      // 复制不显示明文——这两件事是分开的。
      const v = plain || (await fetchPlain());
      (await copy(v)) ? showSuccess(t('已复制')) : showError(t('复制失败'));
    } catch (e) {
      showError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const k = plain || 'YOUR_API_KEY';
  const snippets = {
    openai: [
      `curl ${base}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${k}" \\
  -d '{"model": "smart-router", "messages": [{"role": "user", "content": "你好"}]}'`,
      `from openai import OpenAI

client = OpenAI(api_key="${k}", base_url="${base}/v1")
resp = client.chat.completions.create(
    model="smart-router",
    messages=[{"role": "user", "content": "你好"}],
)
print(resp.choices[0].message.content)`,
    ],
    anthropic: [
      `curl ${base}/v1/messages \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${k}" \\
  -H "anthropic-version: 2023-06-01" \\
  -d '{"model": "glm-anthropic", "max_tokens": 1024,
       "messages": [{"role": "user", "content": "你好"}]}'`,
      `import anthropic

client = anthropic.Anthropic(api_key="${k}", base_url="${base}")
msg = client.messages.create(
    model="glm-anthropic",
    max_tokens=1024,
    messages=[{"role": "user", "content": "你好"}],
)
print(msg.content[0].text)`,
    ],
  };

  if (loading)
    return (
      <div>
        <PageHead title={t('API 密钥')} />
        <Skeleton rows={3} />
      </div>
    );

  if (!token) {
    return (
      <div>
        <PageHead title={t('API 密钥')} />
        <Card>
          <Empty
            text={t(
              '还没有密钥。密钥会在账号开通时自动发放，如果这里一直是空的，说明发放环节出了问题，请告知管理员。',
            )}
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHead
        title={t('API 密钥')}
        sub={t('用它调用下面的接口，不需要额外申请')}
      />

      <Card className='pad'>
        <div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--pt-text-muted)',
              marginBottom: 8,
            }}
          >
            {token.name}
          </div>
          <div className='pt-keyrow'>
            <code className='pt-keyval'>{plain || MASK}</code>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type='button'
                className='pt-btn'
                onClick={toggle}
                disabled={busy}
              >
                {t(plain ? '隐藏' : '显示')}
              </button>
              <button
                type='button'
                className='pt-btn primary'
                onClick={copyKey}
                disabled={busy}
              >
                {t('复制')}
              </button>
            </div>
          </div>
        </div>
      </Card>

      <div className='pt-section'>
        <h2 className='pt-section-title'>{t('怎么调用')}</h2>
        <p className='pt-section-sub'>
          {t(
            '选一种协议，复制走即可。示例里的 YOUR_API_KEY 在你点「显示」后会替换成真实密钥。',
          )}
        </p>
        <Tabs items={PROTOCOLS} value={proto} onChange={setProto} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {snippets[proto].map((code, i) => (
            <CodeBlock key={i} code={code} />
          ))}
        </div>
      </div>
    </div>
  );
}
