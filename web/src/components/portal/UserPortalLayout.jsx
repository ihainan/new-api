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
import React, { useContext, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Dropdown } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { usePortalT } from './shared';
import { UserContext } from '../../context/User';
import { API, getSystemName, showError } from '../../helpers';
import BrandMark from './BrandMark';
import './portal.css';

/*
 * 员工门户外壳。只在 !isAdmin() 分支渲染，管理员完全走原来的 Header/Sider，
 * 这个文件不被管理端引用。
 *
 * 布局照搬 ZGCAI-Coding-Plan 的 portal：232px 白色侧栏 + 居中内容区，
 * 账号块沉在侧栏底部。导航是固定的核心功能，不做个性化隐藏——
 * 给一个可以关掉其中任何一项的开关只会制造困惑。
 */

const Icon = ({ path }) => (
  <svg
    className='pt-icon'
    width='17'
    height='17'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.7'
    strokeLinecap='round'
    strokeLinejoin='round'
    aria-hidden='true'
  >
    {path}
  </svg>
);

/* 只给中英两种。其余语种的译文仍在仓库里（管理端在用），前台不列——
   员工界面没人用得上，菜单里摆七行反而挡住下面的退出。
   名字写它自己的语言：看不懂当前界面的人正是靠这一行找回来的。 */
const LANGS = [
  ['zh-CN', '中文'],
  ['en', 'English'],
];

const ICONS = {
  overview: (
    <>
      <rect x='3' y='3' width='7' height='9' rx='1.5' />
      <rect x='14' y='3' width='7' height='5' rx='1.5' />
      <rect x='14' y='12' width='7' height='9' rx='1.5' />
      <rect x='3' y='16' width='7' height='5' rx='1.5' />
    </>
  ),
  keys: (
    <>
      <circle cx='7.5' cy='15.5' r='3.5' />
      <path d='M10 13L20 3' />
      <path d='M17 6l2.5 2.5' />
    </>
  ),
  models: (
    <>
      <path d='M12 3l2.4 5.6L20 11l-5.6 2.4L12 19l-2.4-5.6L4 11l5.6-2.4z' />
    </>
  ),
  records: (
    <>
      <path d='M4 5h16' />
      <path d='M4 12h16' />
      <path d='M4 19h10' />
    </>
  ),
  // 钟面。使用记录也是「几条横线」，两个都用清单形状就分不出来了；
  // 这一页讲的是还在走的时间，钟比清单贴切。
  tasks: (
    <>
      <circle cx='12' cy='12' r='8.5' />
      <path d='M12 7.5V12l3 1.8' />
    </>
  ),
};

// 路由沿用现有的，不新增不改名：旧书签、文档链接、管理员跳转都不会断。
// label 是中文原文，同时也是 i18n 的 key——这套方案缺翻译时回退成中文，
// 不会变成空白或 key 名。
const NAV = [
  {
    key: 'overview',
    to: '/console/dashboard',
    label: '概览',
    icon: 'overview',
  },
  { key: 'keys', to: '/console/token', label: 'API 密钥', icon: 'keys' },
  { key: 'models', to: '/pricing', label: '模型', icon: 'models' },
  { key: 'records', to: '/console/log', label: '使用记录', icon: 'records' },
  // 视频这类异步生成有自己的一套字段（状态/进度/结果链接），
  // 塞进使用记录的筛选器里既挤又难找，单独给一页
  { key: 'tasks', to: '/console/task', label: '任务队列', icon: 'tasks' },
];

function Avatar({ name }) {
  // 用户名首字，配一个由名字决定的稳定底色，避免刷新就换颜色。
  const letter = (name || '?').trim().charAt(0).toUpperCase();
  const hue = useMemo(() => {
    let h = 0;
    for (const ch of name || '') h = (h * 31 + ch.charCodeAt(0)) % 360;
    return h;
  }, [name]);
  return (
    <div
      style={{
        width: 30,
        height: 30,
        flex: 'none',
        borderRadius: '50%',
        background: `hsl(${hue} 42% 92%)`,
        color: `hsl(${hue} 38% 34%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {letter}
    </div>
  );
}

export default function UserPortalLayout({ children }) {
  const { i18n } = useTranslation();
  const t = usePortalT();
  const location = useLocation();
  const navigate = useNavigate();
  const [userState, userDispatch] = useContext(UserContext);

  const user = userState?.user;
  const systemName = getSystemName();
  // 面板只有中英两种：其他语种的浏览器按英文显示，菜单里也就高亮 English
  const lang = String(i18n.language || '').toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';

  /*
   * 切语言：先立刻换界面，再把偏好存回账号——存不上也不影响这次切换，
   * 本地那份 i18nextLng 会记住。
   */
  const switchLang = async (code) => {
    if (code === lang) return;
    i18n.changeLanguage(code);
    localStorage.setItem('i18nextLng', code);
    if (user?.id) {
      try {
        await API.put('/api/user/self', { language: code });
      } catch (e) {
        // 只是没记到账号上，下次换台机器要重选一次，不值得打断
      }
    }
  };

  const isActive = (item) => {
    const path = location.pathname;
    if (item.to === '/pricing') return path.startsWith('/pricing');
    return path === item.to || path.startsWith(item.to + '/');
  };

  const logout = async () => {
    try {
      await API.get('/api/user/logout');
    } catch (e) {
      // 服务端没确认也要清掉本地会话，但不假装一切正常。
      showError(
        t('已退出本地登录，但服务端没有确认。请重新登录一次，确保状态正确。'),
      );
    }
    userDispatch({ type: 'logout' });
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className='pt-shell'>
      <aside className='pt-sidebar'>
        {/* 窄屏下文字被隐藏，只剩图标；不给 aria-label 的话读屏念不出是哪一项 */}
        <Link
          to='/console/dashboard'
          className='pt-brand'
          aria-label={systemName}
        >
          <BrandMark size={24} />
          <span className='pt-wordmark'>{systemName}</span>
        </Link>

        <nav className='pt-nav'>
          {NAV.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              className={isActive(item) ? 'active' : ''}
              aria-current={isActive(item) ? 'page' : undefined}
              aria-label={t(item.label)}
            >
              <Icon path={ICONS[item.icon]} />
              <span className='pt-lbl'>{t(item.label)}</span>
            </Link>
          ))}
        </nav>

        <div className='pt-side-foot'>
          <Dropdown
            trigger='click'
            position='topLeft'
            render={
              <Dropdown.Menu>
                {/*
                 * 语言。整站的文案早就有七种译文，但前台一直没有切换的地方，
                 * 只能跟着浏览器走——这里是唯一的常驻菜单，就放在这。
                 * 选中的那一项自己标出来，不然菜单里看不出当前是哪种。
                 */}
                <Dropdown.Title>{t('语言')}</Dropdown.Title>
                {LANGS.map(([code, label]) => (
                  <Dropdown.Item
                    key={code}
                    active={lang === code}
                    onClick={() => switchLang(code)}
                  >
                    {label}
                  </Dropdown.Item>
                ))}
                <Dropdown.Divider />
                {/* 只有退出。个人设置那一屏是上游给管理员用的，员工用不到。 */}
                <Dropdown.Item type='danger' onClick={logout}>
                  {t('退出登录')}
                </Dropdown.Item>
              </Dropdown.Menu>
            }
          >
            <div className='pt-account' tabIndex={0} role='button'>
              <Avatar name={user?.display_name || user?.username} />
              <div className='pt-acct-text'>
                <div className='pt-acct-name'>
                  {user?.display_name || user?.username || '…'}
                </div>
                <div className='pt-acct-sub'>{user?.username || ''}</div>
              </div>
            </div>
          </Dropdown>
        </div>
      </aside>

      <main className='pt-content'>{children}</main>
    </div>
  );
}
