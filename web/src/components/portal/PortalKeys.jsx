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
import { Card, Empty, PageHead, Skeleton, fmtTime, usePortalT } from './shared';

/*
 * API 密钥页。这里只做一件事：让人确认自己账号下有哪几把密钥、分别是哪一把。
 *
 * 不显示完整密钥、不提供复制、也不放调用示例——密钥由智能创新部统一发放，
 * 页面不承担分发职责。列表接口返回的本来就是打过码的 key（前四位 + 后四位），
 * 明文那个接口这页根本不调。
 */

// 列表接口给的是 `ltFC**********S3yP` 这种形态，这里只留前四位
const prefixOf = (masked) => {
  const head = String(masked || '').split('*')[0].slice(0, 4);
  return head ? `sk-${head}••••••••` : 'sk-••••••••';
};

export default function PortalKeys() {
  const t = usePortalT();
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/token/?p=0&size=100');
      if (!res.data?.success) {
        showError(res.data?.message || t('获取密钥失败'));
        return;
      }
      const items = res.data.data?.items || [];
      // 启用中的排在前面，同类按创建时间倒序
      setTokens(
        [...items].sort(
          (a, b) =>
            (b.status === 1) - (a.status === 1) ||
            (b.created_time || 0) - (a.created_time || 0),
        ),
      );
    } catch (e) {
      showError(t('获取密钥失败'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHead title={t('API 密钥')} sub={t('你账号下已开通的密钥')} />

      {/* 这页最重要的一句话：密钥怎么拿。放在最上面，字号和字重都压过下面的列表 */}
      <div className='pt-notice'>
        <p className='pt-notice-main'>
          {t('需要调用两院私有部署的模型，请联系智能创新部的符积高开通并获取密钥。')}
        </p>
        <p className='pt-notice-sub'>
          {t(
            '出于安全考虑，本页只显示密钥的前几位供核对，不展示完整内容，也不提供复制。密钥请勿转发或提交到代码仓库。',
          )}
        </p>
      </div>

      {loading ? (
        <Skeleton rows={3} />
      ) : tokens.length === 0 ? (
        <Card>
          <Empty text={t('账号下还没有密钥。')} />
        </Card>
      ) : (
        <Card>
          <div className='pt-table-wrap'>
            <table className='pt-table pt-key-table'>
              <thead>
                <tr>
                  <th>{t('名称')}</th>
                  <th>{t('密钥')}</th>
                  <th>{t('状态')}</th>
                  <th>{t('创建时间')}</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((it) => (
                  <tr key={it.id}>
                    <td>{it.name || '—'}</td>
                    <td className='pt-mono'>{prefixOf(it.key)}</td>
                    <td>
                      <span
                        className={`pt-tag ${it.status === 1 ? 'ok' : 'plain'}`}
                      >
                        {t(it.status === 1 ? '启用中' : '已停用')}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {fmtTime(it.created_time)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
