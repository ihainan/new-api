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

import React, { useMemo, useState } from 'react';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import python from 'highlight.js/lib/languages/python';
import { copy, showError, showSuccess } from '../../helpers';
import ModelIcon from './ModelIcon';
import { DrawerShell, useDrawerParam } from './Drawer';
import { describe } from './modelCatalog';
import {
  KEY_ENV,
  PROXY_BASE,
  UNTESTED_PARAMS,
  callNotes,
  callParams,
  curlSnippet,
  pythonSnippet,
} from './callSpec';
import { usePortalT, withMarks } from './shared';
import { agentPrompt, docMarkdown, docPath } from './docMarkdown';
import { VOICE_COUNT, VOICE_DEMO_URL, VOICE_GROUPS } from './ttsVoices';

/*
 * 调用文档抽屉。从模型卡片上的「调用文档」打开，地址栏带 ?doc=<模型 ID>，
 * 所以这一页可以直接发给同事，浏览器的后退键也能关掉它。
 *
 * 为什么挂在模型旁边而不是像别家那样在密钥页写一段：这个平台同时有对话、
 * Anthropic 协议、出图、异步视频、向量、重排、语音转文字、文字转语音八种形状，
 * 路径、请求体、返回各不相同，而且真正坑人的东西（哪个模型静默截断、
 * 哪个参数填了会 400）也都是逐模型的。
 *
 * 代码里不出现真实密钥：密钥页刻意只显示前几位、不提供复制，这里打印明文
 * 等于绕开那条规矩。密钥一律走环境变量。
 *
 * 高亮只注册 bash 和 python 两种语言，不引整包：全量语言包有几百 KB，
 * 而这里永远只有这两种。配色写在 portal.css 里，没有引 highlight.js 自带的主题，
 * 那些主题自带背景色和字号，会和门户的代码块打架。
 */

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('python', python);

function Snippet({ code, lang }) {
  const t = usePortalT();
  // highlight.js 出的是 HTML，但输入是我们自己生成的代码，不是用户输入
  const html = useMemo(() => {
    try {
      return hljs.highlight(code, { language: lang === 'python' ? 'python' : 'bash' })
        .value;
    } catch (e) {
      return null;
    }
  }, [code, lang]);
  return (
    <div className='pt-snip'>
      <div className='pt-snip-head'>
        <span className='pt-snip-lang'>{lang}</span>
        <button
          type='button'
          className='pt-rowlink'
          onClick={async () => {
            (await copy(code))
              ? showSuccess(t('已复制'))
              : showError(t('复制失败'));
          }}
        >
          {t('复制')}
        </button>
      </div>
      <pre className='pt-snip-body'>
        {html ? (
          // 不用 hljs 这个类名：全站 markdown.css 里的 .hljs 给它加了
          // display:block + overflow-x:auto + 管理端的颜色变量，
          // 结果代码块自己变成一个没有滚动条、也滚不动的框（用户实测指出）。
          <code
            className='pt-hl'
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <code>{code}</code>
        )}
      </pre>
    </div>
  );
}

/*
 * cosy-voice 的可用音色。默认收起——两百多个音色常开会把整篇文档淹掉。
 * 点音色 ID 就复制：要的就是那个 ID，照抄最容易抄错。
 * 演示页那句「实验性、未授权」原样带过来：这是用这些音色之前必须知道的。
 */
function VoiceList() {
  const t = usePortalT();
  const copyId = async (id) => {
    (await copy(id)) ? showSuccess(t('已复制') + ' ' + id) : showError(t('复制失败'));
  };
  return (
    <details className='pt-params pt-voices'>
      <summary>
        <span>{t('可用音色')}</span>
        <span className='pt-params-count'>{VOICE_COUNT}</span>
      </summary>
      <div className='pt-voices-head'>
        <p className='pt-params-note'>
          {t(
            '音色是 CosyVoice3 零样本克隆的实验性成果，用于内部能力评估，不是已授权的生产音色，请勿据此对外承诺。',
          )}
        </p>
        <p className='pt-params-note'>
          <a
            className='pt-inline-link'
            href={VOICE_DEMO_URL}
            target='_blank'
            rel='noopener noreferrer'
          >
            {t('试听全部音色')}
          </a>
          {' · '}
          {t('点击音色 ID 复制')}
        </p>
      </div>
      {VOICE_GROUPS.map((g) => (
        <section key={g.tab + g.group} className='pt-voice-group'>
          <h4>
            {t(g.tab)} · {t(g.group)}
            <span className='pt-params-count'>{g.voices.length}</span>
          </h4>
          <div className='pt-voice-grid'>
            {g.voices.map(([id, label]) => (
              <button
                key={id}
                type='button'
                className='pt-voice'
                title={t('点击音色 ID 复制')}
                onClick={() => copyId(id)}
              >
                <span className='pt-voice-label'>{label}</span>
                <code>{id}</code>
              </button>
            ))}
          </div>
        </section>
      ))}
    </details>
  );
}

export default function CallDocDrawer({ modelId, onClose }) {
  const t = usePortalT();
  const [tab, setTab] = useState('curl');

  // 示例里的地址是 LLM Proxy（按构建环境取，见 callSpec.js 的 PROXY_BASE）
  const base = PROXY_BASE;

  const m = describe(modelId);
  const notes = callNotes(modelId);
  const params = callParams(modelId);
  const code =
    tab === 'curl' ? curlSnippet(modelId, base) : pythonSnippet(modelId, base);

  return (
    <DrawerShell
      icon={<ModelIcon model={modelId} size={20} />}
      title={t('调用文档')}
      sub={modelId}
      onClose={onClose}
      actions={
        <>
              {/*
               * 两种复制，各管一种场景：
               *   复制文档 —— 整篇 Markdown，贴给同事、贴进任何 AI 都能用，不依赖网络；
               *   复制给 AI —— 一段话加公开文档的链接，外部 agent 自己去读，
               *                 不用登录；文档更新了，链接指向的也是新的。
               * 两者用的是同一个生成函数（docMarkdown.js），和抽屉里看到的一致。
               */}
              <button
                type='button'
                className='pt-btn sm'
                onClick={async () => {
                  (await copy(docMarkdown(modelId, base)))
                    ? showSuccess(t('已复制完整文档'))
                    : showError(t('复制失败'));
                }}
              >
                {t('复制文档')}
              </button>
              <button
                type='button'
                className='pt-btn sm'
                title={t('复制一段带文档链接的提示词，外部 AI 不用登录就能读取')}
                onClick={async () => {
                  const url = window.location.origin + docPath(modelId);
                  (await copy(agentPrompt(modelId, url)))
                    ? showSuccess(t('已复制，粘贴给 AI 即可'))
                    : showError(t('复制失败'));
                }}
              >
                {t('复制给 AI')}
              </button>
        </>
      }
    >
          {m?.summary ? (
            <p className='pt-drawer-sum'>{withMarks(t(m.summary))}</p>
          ) : null}

          {/* 公共部分：地址、鉴权、密钥从哪来。十一份文档共用这一段的同一个来源。 */}
          <dl className='pt-kv'>
            <div>
              <dt>{t('接口地址')}</dt>
              <dd className='pt-mono'>{base}</dd>
            </div>
            <div>
              <dt>{t('鉴权')}</dt>
              <dd className='pt-mono'>Authorization: Bearer &lt;密钥&gt;</dd>
            </div>
          </dl>

          {/* 不做密钥下拉：这个账号下的每把密钥权限一样，选哪把示例都长得一模一样；
              而且示例里本来就不出现密钥本身，选了也看不出区别。 */}
          {/*
           * 「密钥」链到密钥页、新窗口打开：看文档的人手边未必有密钥，
           * 跳走的话这页的文档就没了。
           * 链接词要能跟着翻译走，所以用 <k>…</k> 在译文里标出来再切开，
           * 不把一句话拆成三个 key 硬拼（英文语序和中文不一样）。
           */}
          <p className='pt-drawer-keyhint'>
            {t('先把<k>密钥</k>放进环境变量：')
              .split(/<k>|<\/k>/)
              .map((part, i) =>
                i === 1 ? (
                  <a
                    key={i}
                    className='pt-inline-link'
                    href='/console/token'
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    {part}
                  </a>
                ) : (
                  <React.Fragment key={i}>{part}</React.Fragment>
                ),
              )}
          </p>
          <Snippet code={`export ${KEY_ENV}=sk-你的密钥`} lang='bash' />

          <div className='pt-chips' role='group' aria-label={t('示例语言')}>
            {[
              ['curl', 'cURL'],
              ['python', 'Python'],
            ].map(([k, label]) => (
              <button
                key={k}
                type='button'
                className={`pt-chip${tab === k ? ' on' : ''}`}
                aria-pressed={tab === k}
                onClick={() => setTab(k)}
              >
                {label}
              </button>
            ))}
          </div>

          <Snippet code={code} lang={tab === 'curl' ? 'bash' : 'python'} />

          {notes.length ? (
            <div className='pt-notes'>
              <h3>{t('注意事项')}</h3>
              <ul>
                {notes.map((n) => (
                  // 和模型描述用同一套行内标记：`voice` 这种要照抄的字符串
                  // 不换字体就认不出来
                  <li key={n}>{withMarks(t(n))}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {/*
           * 参数表默认收起：注意事项是「不看就会踩」，放在上面常开；
           * 参数是「要用时再查」，一张十来行的表常开会把示例代码顶出屏幕。
           * 用原生 <details>：键盘、读屏、无 JS 都能开合，不用自己管状态。
           * 两列不做四列——类型和是否必填跟在参数名下面，
           * 560px 的抽屉里四列会把说明挤成一个字一行。
           */}
          {params.length ? (
            <details className='pt-params'>
              <summary>
                <span>{t('参数')}</span>
                <span className='pt-params-count'>{params.length}</span>
              </summary>
              {UNTESTED_PARAMS.has(modelId) ? (
                <p className='pt-params-note'>
                  {t(
                    '视频参数没有逐个实测（提交一条要花钱），依据的是网关的转发逻辑和视频后端的接口文档。',
                  )}
                </p>
              ) : null}
              <table className='pt-ptable'>
                <tbody>
                  {params.map(([name, type, required, desc]) => (
                    <tr key={name + desc}>
                      <th scope='row'>
                        <code>{name}</code>
                        <span className='pt-ptype'>
                          {type}
                          {required ? (
                            <span className='pt-preq'> · {t('必填')}</span>
                          ) : null}
                        </span>
                      </th>
                      <td>{withMarks(t(desc))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ) : null}

          {modelId === 'cosy-voice' ? <VoiceList /> : null}
    </DrawerShell>
  );
}

// 地址栏 ?doc=<模型 ID> 控制这个抽屉（通用实现见 Drawer.jsx）
export const useDocParam = () => {
  const [docId, openDoc, closeDoc] = useDrawerParam('doc');
  return { docId, openDoc, closeDoc };
};
