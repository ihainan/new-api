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

import React from 'react';
import { usePortalT } from './shared';
import { TASK_HINT, TASK_STEPS, taskSteps, taskState } from './taskInfo';

/*
 * 任务状态：一句状态词 + 三步进度条（排队 → 生成 → 完成）。
 *
 * 原来这里是「排队中 + 20%」。那个 20% 是后端按状态塞的固定值，不是真进度
 * （详见 taskInfo.js），摆出来只会让人以为「已经做了五分之一」。三步走反而
 * 把它真正想说的事说清楚了：现在卡在哪一步、还剩几步。
 */
export default function TaskStatus({ task }) {
  const st = taskState(task);
  const t = usePortalT();
  const steps = taskSteps(task);
  const hint = TASK_HINT[String(task.status || '').toUpperCase()];
  return (
    <div className='pt-tstat' title={hint ? t(hint) : undefined}>
      <span className={`pt-tag ${st.cls}`}>{t(st.text)}</span>
      <ol
        className='pt-steps'
        aria-label={TASK_STEPS.map((s) => t(s)).join(' → ')}
      >
        {steps.map((kind, i) => (
          <li key={TASK_STEPS[i]} className={`pt-step ${kind}`}>
            <span className='pt-step-bar' />
            <span className='pt-step-txt'>{t(TASK_STEPS[i])}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
