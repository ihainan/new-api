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
import { UserContext } from '../../context/User';
import { API, getSystemName, showError } from '../../helpers';
import BrandMark from './BrandMark';
import './portal.css';

/*
 * 员工门户外壳。只在 !isAdmin() 分支渲染，管理员完全走原来的 Header/Sider，
 * 这个文件不被管理端引用。
 *
 * 布局照搬 ZGCAI-Coding-Plan 的 portal：232px 白色侧栏 + 居中内容区，
 * 账号块沉在侧栏底部。四项导航是固定的核心功能，不做个性化隐藏——
 * 员工要做的事就这四件，给他一个可以关掉其中任何一件的开关只会制造困惑。
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
};

// 路由沿用现有的，不新增不改名：旧书签、文档链接、管理员跳转都不会断。
const NAV = [
  { key: 'overview', to: '/console/dashboard', label: '概览', icon: 'overview' },
  { key: 'keys', to: '/console/token', label: 'API 密钥', icon: 'keys' },
  { key: 'models', to: '/pricing', label: '模型', icon: 'models' },
  { key: 'records', to: '/console/log', label: '使用记录', icon: 'records' },
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
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [userState, userDispatch] = useContext(UserContext);

  const user = userState?.user;
  const systemName = getSystemName();

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
      showError(t('退出时服务端未确认，请重新登录确认状态'));
    }
    userDispatch({ type: 'logout' });
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className='pt-shell'>
      <aside className='pt-sidebar'>
        <Link to='/console/dashboard' className='pt-brand'>
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
            >
              <Icon path={ICONS[item.icon]} />
              <span className='pt-lbl'>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className='pt-side-foot'>
          <Dropdown
            trigger='click'
            position='topLeft'
            render={
              <Dropdown.Menu>
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
