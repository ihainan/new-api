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
 * 品牌标记：对话气泡里一颗火花。与 web/public/favicon.svg 是同一份图形，
 * 这里内联成组件是因为侧栏在 24px 下渲染，位图 logo.png 会发虚；
 * 顺带省掉一次图片请求。改图形时两处要一起改。
 *
 * plain：不要那块深色方块，只留图形本身、用当前文字色描边。登录页整页就这一个
 * 图形，方块压在浅底上显得很重。
 */
export default function BrandMark({ size = 24, plain = false }) {
  const ink = plain ? 'currentColor' : '#fff';
  // 带底色时图形要缩进去一点，否则贴着方块边缘
  const scale = plain ? 1 : 0.74;
  const shift = plain ? 0 : (24 - 24 * scale) / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      aria-hidden='true'
      style={{ display: 'block', borderRadius: plain ? 0 : 7, flex: 'none' }}
    >
      {plain ? null : <rect width='24' height='24' rx='7' fill='#14181f' />}
      <g transform={`translate(${shift} ${shift}) scale(${scale})`}>
        <path
          d='M20.4 13.4a3.6 3.6 0 0 1-3.6 3.6H9.2l-4.6 3.3a.5.5 0 0 1-.8-.4V7.4a3.6 3.6 0 0 1 3.6-3.6h9.4a3.6 3.6 0 0 1 3.6 3.6z'
          fill='none'
          stroke={ink}
          strokeWidth='1.8'
          strokeLinejoin='round'
        />
        <path
          d='M12.2 7.3 13.4 10l2.7 1.2-2.7 1.2-1.2 2.7-1.2-2.7L8.3 11.2 11 10z'
          fill={ink}
        />
      </g>
    </svg>
  );
}
