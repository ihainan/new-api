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
import { Alibaba, BAAI, Gemma, Minimax, Qwen, Zhipu } from '@lobehub/icons';
import BrandMark from './BrandMark';
import { describe } from './modelCatalog';

/*
 * 模型图标。模型页和使用记录页共用，所以独立成文件。
 *
 * 图标库的 SVG 自带 <title>（Zhipu、Alibaba、BAAI…），鼠标悬停会弹出厂商名，
 * 而这些页面按要求不写厂商。aria-hidden 挡读屏，portal.css 里用 pointer-events
 * 挡原生提示，两处都要管——删掉 vendor 字段挡不住图标自己带的标题。
 */

const ICONS = { Zhipu, Qwen, Minimax, Gemma, BAAI, Alibaba };

export default function ModelIcon({ icon, model, size = 26 }) {
  // 传 model 时自己查目录，调用方不必关心映射关系
  const name = icon !== undefined ? icon : model ? describe(model).icon : null;
  const Comp = name === 'brand' ? null : name ? ICONS[name] : null;
  const Rendered = Comp ? Comp.Color || Comp : null;

  if (name !== 'brand' && !Rendered) {
    return (
      <span
        className='pt-mdl-icon pt-mdl-icon-none'
        style={{ width: size, height: size }}
        aria-hidden='true'
      />
    );
  }
  return (
    <span
      className='pt-mdl-icon'
      style={{ width: size, height: size }}
      aria-hidden='true'
    >
      {name === 'brand' ? <BrandMark size={size} /> : <Rendered size={size} />}
    </span>
  );
}
