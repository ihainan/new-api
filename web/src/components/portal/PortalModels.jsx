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

import React, { useEffect, useMemo, useState } from 'react';
import { API, copy, showError, showSuccess } from '../../helpers';
import { Card, Empty, PageHead, Skeleton } from './shared';

/*
 * 模型页。回答「我现在能调什么」，不是价目表——倍率、计费方式是管理视角，
 * 员工拿到手要做的事只有一件：把模型 ID 复制进代码。
 */

export default function PortalModels() {
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState([]);
  const [kw, setKw] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await API.get('/api/pricing');
        if (res.data?.success) setModels(res.data.data || []);
        else showError(res.data?.message || '获取模型列表失败');
      } catch (e) {
        showError('获取模型列表失败');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const list = useMemo(() => {
    const q = kw.trim().toLowerCase();
    const arr = models.filter((m) => !q || (m.model_name || '').toLowerCase().includes(q));
    return arr.sort((a, b) => (a.model_name || '').localeCompare(b.model_name || ''));
  }, [models, kw]);

  if (loading) return <div><PageHead title='模型' /><Skeleton rows={4} /></div>;

  return (
    <div>
      <PageHead title='模型' sub='你当前可以调用的模型，复制 ID 填进代码即可' />

      <div className='pt-filters'>
        <input
          className='pt-input'
          style={{ minWidth: 240 }}
          placeholder='搜索模型'
          value={kw}
          onChange={(e) => setKw(e.target.value)}
        />
        <span style={{ fontSize: 13, color: 'var(--pt-text-muted)' }}>
          共 {list.length} 个
        </span>
      </div>

      {list.length === 0 ? (
        <Card><Empty text={kw ? '没有匹配的模型' : '暂无可用模型'} /></Card>
      ) : (
        <div className='pt-model-grid'>
          {list.map((m) => (
            <div className='pt-model' key={m.model_name}>
              <div className='pt-model-id'>{m.model_name}</div>
              <div className='pt-model-foot'>
                {m.enable_groups?.length ? (
                  <span className='pt-tag plain'>{m.enable_groups.join(' / ')}</span>
                ) : <span />}
                <button
                  type='button'
                  className='pt-btn sm'
                  onClick={async () => {
                    (await copy(m.model_name)) ? showSuccess('已复制') : showError('复制失败');
                  }}
                >
                  复制 ID
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
