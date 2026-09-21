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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import python from 'highlight.js/lib/languages/python';
import { copy, showError, showSuccess } from '../../helpers';
import ModelIcon from './ModelIcon';
import { describe } from './modelCatalog';
import { KEY_ENV, callNotes, curlSnippet, pythonSnippet } from './callSpec';
import { usePortalT, withMarks } from './shared';

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

export default function CallDocDrawer({ modelId, onClose }) {
  const t = usePortalT();
  const [tab, setTab] = useState('curl');
  const panel = useRef(null);

  // 示例里的地址就用当前这个站点：门户和网关是同一个源，
  // 写死或者去读后台配的「系统地址」都可能和用户实际访问的地址对不上。
  const base = window.location.origin;

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

  const m = describe(modelId);
  const notes = callNotes(modelId);
  const code =
    tab === 'curl' ? curlSnippet(modelId, base) : pythonSnippet(modelId, base);

  return (
    <div className='pt-drawer-wrap' role='dialog' aria-modal='true'>
      <div className='pt-drawer-mask' onClick={onClose} />
      <aside className='pt-drawer' ref={panel} tabIndex={-1}>
        <header className='pt-drawer-head'>
          <div className='pt-cell-row'>
            <ModelIcon model={modelId} size={20} />
            <div className='pt-stack'>
              <strong>{t('调用文档')}</strong>
              <span className='pt-sub pt-mono'>{modelId}</span>
            </div>
          </div>
          <button
            type='button'
            className='pt-drawer-x'
            aria-label={t('关闭')}
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        <div className='pt-drawer-body'>
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
        </div>
      </aside>
    </div>
  );
}

/*
 * 地址栏里的 ?doc=<模型 ID> 就是抽屉的开关：能把链接发给同事，后退键能关。
 */
export function useDocParam() {
  const read = () => new URLSearchParams(window.location.search).get('doc');
  const [id, setId] = useState(read);

  useEffect(() => {
    const onPop = () => setId(read());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const open = useCallback((next) => {
    const u = new URL(window.location.href);
    u.searchParams.set('doc', next);
    window.history.pushState({}, '', u);
    setId(next);
  }, []);

  const close = useCallback(() => {
    const u = new URL(window.location.href);
    u.searchParams.delete('doc');
    window.history.pushState({}, '', u);
    setId(null);
  }, []);

  return { docId: id, openDoc: open, closeDoc: close };
}
