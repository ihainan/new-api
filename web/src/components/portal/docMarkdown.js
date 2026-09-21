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

import {
  KEY_ENV,
  UNTESTED_PARAMS,
  callNotes,
  callParams,
  curlSnippet,
  hasCallDoc,
  pythonSnippet,
} from './callSpec';
import { HIDDEN, MODELS, describe } from './modelCatalog';
import { VOICE_DEMO_URL, VOICE_GROUPS } from './ttsVoices';

/*
 * 把一个模型的调用文档拼成一篇 Markdown。两处用它：
 *   - 抽屉里的「复制文档」——整篇贴给同事或 AI；
 *   - 构建时生成的公开文件 /docs/models/<模型>.md——「复制给 AI」里放的就是它的链接，
 *     外部 agent 不带登录就能直接读（网关对 web/dist 是免认证的静态服务）。
 * 两处用同一个函数，抽屉里看到的和 agent 读到的不会是两个版本。
 *
 * 这个文件不碰 DOM、不用 React，构建脚本在 Node 里也能直接调用。
 */

// 模型 ID 里有冒号（qwen3-embedding:4b），放进文件名和链接之前换掉
export const docSlug = (id) => String(id).replace(/[^a-zA-Z0-9._-]/g, '-');

export const docPath = (id) => `/docs/models/${docSlug(id)}.md`;

// 表格单元格里不能有换行和竖线
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function docMarkdown(id, base) {
  if (!hasCallDoc(id)) return '';
  const m = describe(id) || {};
  const out = [];
  out.push(`# ${m.name || id} · \`${id}\``, '');
  if (m.summary) out.push(m.summary, '');
  if (m.detail) out.push(m.detail, '');

  out.push(
    '## 接入信息',
    '',
    `- 接口地址：\`${base}\``,
    `- 模型 ID：\`${id}\``,
    '- 鉴权：请求头 `Authorization: Bearer <密钥>`',
    `- 密钥放进环境变量，不要写进代码：\`export ${KEY_ENV}=sk-你的密钥\``,
    '',
    '## cURL',
    '',
    '```bash',
    curlSnippet(id, base),
    '```',
    '',
    '## Python',
    '',
    '```python',
    pythonSnippet(id, base),
    '```',
    '',
  );

  const notes = callNotes(id);
  if (notes.length) {
    out.push('## 注意事项', '', ...notes.map((n) => `- ${n}`), '');
  }

  const params = callParams(id);
  if (params.length) {
    out.push('## 参数', '');
    if (UNTESTED_PARAMS.has(id)) {
      out.push(
        '> 视频参数没有逐个实测（提交一条要花钱），依据的是网关的转发逻辑和视频后端的接口文档。',
        '',
      );
    }
    out.push('| 参数 | 类型 | 必填 | 说明 |', '| --- | --- | --- | --- |');
    params.forEach(([name, type, required, desc]) => {
      out.push(
        `| \`${cell(name)}\` | ${cell(type)} | ${required ? '是' : '否'} | ${cell(desc)} |`,
      );
    });
    out.push('');
  }

  if (id === 'cosy-voice') {
    out.push(
      '## 可用音色',
      '',
      `用 \`voice\` 传音色 ID。试听：${VOICE_DEMO_URL}`,
      '',
      '> 音色是 CosyVoice3 零样本克隆的实验性成果，用于内部能力评估，不是已授权的生产音色，请勿据此对外承诺。',
      '',
    );
    VOICE_GROUPS.forEach((g) => {
      out.push(`### ${g.tab} · ${g.group}（${g.voices.length}）`, '');
      g.voices.forEach(([vid, label]) => out.push(`- \`${vid}\` ${label}`));
      out.push('');
    });
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// 所有要公开文档的模型，给构建脚本用。下架的（HIDDEN）不生成——
// 页面上看不到的模型，公开文档里也不该出现
export const docModelIds = () =>
  MODELS.map((m) => m.id).filter((id) => hasCallDoc(id) && !HIDDEN.has(id));

/*
 * 「复制给 AI」的那段话。只放链接，不放正文：外部 agent 自己去读，
 * 聊天框里不用塞一大段代码；文档更新了，链接指向的也是新的。
 */
export function agentPrompt(id, docUrl) {
  const m = describe(id) || {};
  return [
    `请先读取这份调用文档，了解 ZGCAI Model Hub 上「${m.name || id}」（模型 ID：${id}）怎么调用：`,
    docUrl,
    '',
    `密钥从环境变量 ${KEY_ENV} 读取，不要写进代码。`,
  ].join('\n');
}
