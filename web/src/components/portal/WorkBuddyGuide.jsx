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
import { copy, showError, showSuccess } from '../../helpers';
import { DrawerShell } from './Drawer';
import { PROXY_BASE } from './callSpec';
import { usePortalT } from './shared';

/*
 * 在 WorkBuddy 里接入 smart-router 的图文教程。从 smart-router 卡片上的
 * 「接入 WorkBuddy」打开，地址栏 ?guide=workbuddy，可以直接把链接发给同事。
 *
 * 步骤照着真实界面截的图写（WorkBuddy 5.5.4），用的是完整截图（只缩小压缩，
 * 不裁剪），红框标出了每一步要点的位置。
 *
 * 接口地址要填到 /v1/chat/completions 为止——WorkBuddy 的「自定义」供应商
 * 要的是完整地址，不是 base URL，这是最容易填错的一处，所以单独提醒。
 */

export const WORKBUDDY_ICON = '/logos/workbuddy.png';
const IMG = (n) => `/guides/workbuddy/step-${n}.webp`;

function CopyValue({ value }) {
  const t = usePortalT();
  return (
    <span className='pt-guide-value'>
      <code>{value}</code>
      <button
        type='button'
        className='pt-rowlink'
        onClick={async () => {
          (await copy(value))
            ? showSuccess(t('已复制'))
            : showError(t('复制失败'));
        }}
      >
        {t('复制')}
      </button>
    </span>
  );
}

function Step({ n, title, img, alt, children }) {
  return (
    <li className='pt-guide-step'>
      <h3>
        <span className='pt-guide-n'>{n}</span>
        {title}
      </h3>
      {children}
      {/* 完整截图缩在抽屉里字很小，点开在新窗口看原尺寸 */}
      {img ? (
        <a
          className='pt-guide-imglink'
          href={img}
          target='_blank'
          rel='noopener noreferrer'
          title={alt}
        >
          <img
            className='pt-guide-img'
            src={img}
            alt={alt}
            loading='lazy'
            decoding='async'
          />
        </a>
      ) : null}
    </li>
  );
}

export default function WorkBuddyGuide({ onClose }) {
  const t = usePortalT();
  const endpoint = `${PROXY_BASE}/v1/chat/completions`;
  const keysLink = (
    <a
      className='pt-inline-link'
      href='/console/token'
      target='_blank'
      rel='noopener noreferrer'
    >
      {t('API 密钥')}
    </a>
  );

  return (
    <DrawerShell
      icon={
        <img src={WORKBUDDY_ICON} width={20} height={20} alt='' className='pt-guide-logo' />
      }
      title={t('接入 WorkBuddy')}
      sub='smart-router'
      onClose={onClose}
    >
      <p className='pt-drawer-sum'>
        {t(
          'WorkBuddy 支持接入自定义的 OpenAI 兼容模型。按下面六步把 smart-router 加进去，就能在 WorkBuddy 里直接使用两院私有部署的模型——它会按问题自动选择合适的后端。',
        )}
      </p>
      <p className='pt-guide-before'>
        {t('开始之前，先到')} {keysLink} {t('页准备好你的密钥。')}
      </p>

      <ol className='pt-guide'>
        <Step
          n={1}
          title={t('打开设置')}
          img={IMG(1)}
          alt={t('点击左下角头像，在菜单中选择「设置」')}
        >
          <p>{t('安装并登录 WorkBuddy。点击左下角的头像，在弹出的菜单中选择「设置」。')}</p>
        </Step>

        <Step
          n={2}
          title={t('添加模型')}
          img={IMG(2)}
          alt={t('设置页左侧选择「模型」，右上角点击「添加模型」')}
        >
          <p>{t('在设置页左侧点「模型」，再点右上角的「添加模型」。')}</p>
        </Step>

        <Step
          n={3}
          title={t('选择「自定义」供应商')}
          img={IMG(3)}
          alt={t('供应商下拉框里选择最下面「其他」分组中的「自定义」')}
        >
          <p>{t('点开「供应商」下拉框，选最下面「其他」分组里的「自定义」。')}</p>
        </Step>

        <Step
          n={4}
          title={t('填写接入信息')}
          img={IMG(4)}
          alt={t('填好接口地址、API Key、模型名称，勾选高级配置')}
        >
          <p>{t('按下表填写，先点「测试连接」，通过后再点「保存」。')}</p>
          <dl className='pt-guide-form'>
            <div>
              <dt>{t('接口地址')}</dt>
              <dd>
                <CopyValue value={endpoint} />
                <span className='pt-guide-hint'>
                  {t('要填完整地址，一直写到 /v1/chat/completions，不能只填域名。')}
                </span>
              </dd>
            </div>
            <div>
              <dt>API Key</dt>
              <dd>
                {t('你的密钥，到')} {keysLink} {t('页获取。')}
              </dd>
            </div>
            <div>
              <dt>{t('模型名称')}</dt>
              <dd>
                <CopyValue value='smart-router' />
              </dd>
            </div>
            <div>
              <dt>{t('高级配置')}</dt>
              <dd>
                {t(
                  '勾选「工具调用」「图片输入」「思考模式」，其余保持默认。勾上「思考模式」后，「允许关闭思考」会自动勾上，不用单独点。',
                )}
              </dd>
            </div>
          </dl>
        </Step>

        <Step
          n={5}
          title={t('切换到 smart-router')}
          img={IMG(5)}
          alt={t('输入框右下角的模型选择中，选择自定义模型下的 smart-router')}
        >
          <p>
            {t('回到对话界面，点输入框右下角的模型选择，在「自定义模型」里选 smart-router。')}
          </p>
        </Step>

        <Step
          n={6}
          title={t('发消息试一下')}
          img={IMG(6)}
          alt={t('发送消息后 WorkBuddy 正常回复，回复下方显示 smart-router')}
        >
          <p>{t('随便发一条消息，能正常回复、回复下方显示 smart-router，就接好了。')}</p>
        </Step>
      </ol>

      <div className='pt-notes'>
        <h3>{t('没有正常回复？')}</h3>
        <ul>
          <li>{t('接口地址是否完整，一直写到 /v1/chat/completions。')}</li>
          <li>{t('API Key 前后有没有多粘了空格，密钥是否还在启用中。')}</li>
          <li>{t('模型名称是否是 smart-router，大小写和连字符都要一致。')}</li>
          <li>{t('以上都没问题仍然不行，请联系智能创新中心。')}</li>
        </ul>
      </div>
    </DrawerShell>
  );
}
