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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePortalT } from './shared';

/*
 * 右侧抽屉的外壳：遮罩、标题栏、关闭、Esc、焦点、锁住背后的页面。
 * 调用文档和接入教程都用它——之前外壳长在调用文档里，再加一种抽屉就得
 * 复制一份，Esc、滚动锁这些修过的坑也得在两处各修一遍。
 */
export function DrawerShell({ icon, title, sub, actions, onClose, children }) {
  const t = usePortalT();
  const panel = useRef(null);

  // Esc 关闭 + 打开时把焦点移进来，否则键盘用户还停在后面的列表上
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    panel.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  /*
   * 抽屉开着的时候锁住背后的页面：不锁的话触摸板一滚，背后的模型列表跟着跑，
   * 关掉抽屉发现自己已经不在原来的位置了（用户实测指出）。
   * 直接 overflow:hidden 会让竖直滚动条消失、页面横向跳一下，
   * 所以把滚动条那点宽度补成 padding。
   */
  useEffect(() => {
    const { body } = document;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    const prev = { overflow: body.style.overflow, pad: body.style.paddingRight };
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = prev.overflow;
      body.style.paddingRight = prev.pad;
    };
  }, []);

  return (
    <div className='pt-drawer-wrap' role='dialog' aria-modal='true'>
      <div className='pt-drawer-mask' onClick={onClose} />
      <aside className='pt-drawer' ref={panel} tabIndex={-1}>
        <header className='pt-drawer-head'>
          <div className='pt-cell-row'>
            {icon}
            <div className='pt-stack'>
              <strong>{title}</strong>
              {sub ? <span className='pt-sub pt-mono'>{sub}</span> : null}
            </div>
          </div>
          <div className='pt-drawer-actions'>
            {actions}
            <button
              type='button'
              className='pt-drawer-x'
              aria-label={t('关闭')}
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </header>
        <div className='pt-drawer-body'>{children}</div>
      </aside>
    </div>
  );
}

/*
 * 地址栏里的 ?<name>=<值> 就是抽屉的开关：链接能发给同事，后退键能关。
 * 调用文档用 ?doc=<模型 ID>，接入教程用 ?guide=<工具>。
 */
export function useDrawerParam(name) {
  const read = useCallback(
    () => new URLSearchParams(window.location.search).get(name),
    [name],
  );
  const [value, setValue] = useState(read);

  useEffect(() => {
    const onPop = () => setValue(read());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [read]);

  const open = useCallback(
    (next) => {
      const u = new URL(window.location.href);
      u.searchParams.set(name, next);
      window.history.pushState({}, '', u);
      setValue(next);
    },
    [name],
  );

  const close = useCallback(() => {
    const u = new URL(window.location.href);
    u.searchParams.delete(name);
    window.history.pushState({}, '', u);
    setValue(null);
  }, [name]);

  return [value, open, close];
}
