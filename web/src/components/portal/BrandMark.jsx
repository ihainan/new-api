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

/*
 * 品牌标记。与 web/public/favicon.svg 是同一份图形，这里内联成组件是因为侧栏在
 * 24px 下渲染，位图 logo.png 会发虚；顺带省掉一次图片请求。
 * 改图形时两处要一起改。
 */
export default function BrandMark({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      aria-hidden='true'
      style={{ display: 'block', borderRadius: 7, flex: 'none' }}
    >
      <rect width='24' height='24' rx='7' fill='#14181f' />
      <g
        stroke='#fff'
        strokeWidth='1.8'
        strokeLinecap='round'
        fill='none'
        opacity='0.78'
      >
        <path d='M12 12 L12 6.6' />
        <path d='M12 12 L7.3 15.1' />
        <path d='M12 12 L16.7 15.1' />
      </g>
      <circle cx='12' cy='6.3' r='1.85' fill='#fff' opacity='0.72' />
      <circle cx='7.1' cy='15.4' r='1.85' fill='#fff' opacity='0.72' />
      <circle cx='16.9' cy='15.4' r='1.85' fill='#fff' opacity='0.72' />
      <circle cx='12' cy='12' r='3.15' fill='#fff' />
    </svg>
  );
}
