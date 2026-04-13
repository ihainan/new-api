import React, { useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Dropdown } from '@douyinfe/semi-ui';
import { ChevronDown } from 'lucide-react';
import { UserContext } from '../../context/User';
import { API, getLogo, getSystemName, stringToColor } from '../../helpers';

/* ─── AIHubMix 原版 SVG 图标 ─── */
const IconHome = () => (
  <svg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg' style={{ display: 'block' }}>
    <path d='M2 6.667L8 2l6 4.667V14a.667.667 0 0 1-.667.667H10V10H6v4.667H2.667A.667.667 0 0 1 2 14V6.667Z' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' />
  </svg>
);

const IconPlayground = () => (
  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' style={{ display: 'block' }}>
    <path d='M16 13L21.223 16.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
    <path d='M14 6H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2Z' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
  </svg>
);

const IconKey = () => (
  <svg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg' style={{ display: 'block' }}>
    <path d='M10.333 5l1.534 1.533a.667.667 0 0 0 .933 0l1.4-1.4a.667.667 0 0 0 0-.933L12.667 2.667' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' />
    <path d='M14 1.333L7.6 7.733' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' />
    <path d='M5 14a3.333 3.333 0 1 0 0-6.667A3.333 3.333 0 0 0 5 14Z' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' />
  </svg>
);

/* ─── 单个导航链接 ─── */
const NavLink = ({ to, label, icon, currentPath }) => {
  const isActive = to === '/' ? currentPath === '/' : currentPath.startsWith(to);

  return (
    <Link
      to={to}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        borderRadius: 6,
        textDecoration: 'none',
        fontSize: 14,
        fontWeight: isActive ? 500 : 400,
        color: isActive ? 'rgba(0,0,0,0.88)' : 'rgba(0,0,0,0.65)',
        background: isActive ? 'rgba(0,0,0,0.04)' : 'transparent',
        transition: 'background 0.15s, color 0.15s',
        whiteSpace: 'nowrap',
        lineHeight: 1,
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = 'rgba(0,0,0,0.04)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = 'transparent';
      }}
    >
      <span style={{ color: isActive ? 'rgba(0,0,0,0.88)' : 'rgba(0,0,0,0.65)' }}>
        {icon}
      </span>
      {label}
    </Link>
  );
};

/* ─── 主组件 ─── */
const SimpleHeader = () => {
  const [userState, userDispatch] = useContext(UserContext);
  const location = useLocation();
  const navigate = useNavigate();

  const logo = getLogo();
  const systemName = getSystemName();
  const user = userState.user;
  const currentPath = location.pathname;

  const logout = async () => {
    await API.get('/api/user/logout');
    userDispatch({ type: 'logout' });
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        height: 56,
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(5,5,5,0.06)',
        boxSizing: 'border-box',
        fontFamily: 'Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
      }}
    >
      {/* 内容居中容器，max-width 1152px，与 AIHubMix 一致 */}
      <div
        style={{
          maxWidth: 1152,
          margin: '0 auto',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          paddingInlineStart: 16,
          paddingInlineEnd: 16,
          gap: 0,
        }}
      >
        {/* Logo */}
        <Link
          to='/'
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            textDecoration: 'none',
            flexShrink: 0,
            marginInlineEnd: 8,
          }}
        >
          <img
            src={logo}
            alt='logo'
            height={32}
            style={{ display: 'inline-block', verticalAlign: 'middle', borderRadius: '50%' }}
          />
          <h1
            style={{
              display: 'inline-block',
              margin: 0,
              lineHeight: '24px',
              marginInlineStart: 0,
              fontWeight: 600,
              fontSize: 16,
              color: 'rgba(0,0,0,0.88)',
              verticalAlign: 'top',
              whiteSpace: 'nowrap',
            }}
          >
            {systemName}
          </h1>
        </Link>

        {/* 导航菜单：flex-1，6px 内边距（与 AIHubMix ant-pro-top-nav-header-menu 一致） */}
        <nav
          style={{
            flex: '1 1 0%',
            display: 'flex',
            alignItems: 'center',
            padding: '6px 6px',
            lineHeight: '44px',
            minWidth: 0,
            gap: 2,
          }}
        >
          <NavLink to='/' label='首页' icon={<IconHome />} currentPath={currentPath} />
          <NavLink to='/console/playground' label='Playground' icon={<IconPlayground />} currentPath={currentPath} />
          <NavLink to='/console/token' label='Keys' icon={<IconKey />} currentPath={currentPath} />
        </nav>

        {/* 右侧：用户区域 */}
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 8 }}>
          {user ? (
            <Dropdown
              position='bottomRight'
              render={
                <Dropdown.Menu>
                  <Dropdown.Item onClick={logout}>退出登录</Dropdown.Item>
                </Dropdown.Menu>
              }
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  padding: '0 4px',
                }}
              >
                <Avatar
                  size='extra-small'
                  color={stringToColor(user.username)}
                  style={{ width: 28, height: 28, fontSize: 14, lineHeight: '28px', flexShrink: 0 }}
                >
                  {user.username[0].toUpperCase()}
                </Avatar>
                <span style={{ fontSize: 14, color: 'rgba(0,0,0,0.88)', marginInlineStart: 0, fontWeight: 400 }}>
                  {user.username}
                </span>
              </div>
            </Dropdown>
          ) : (
            <Link
              to='/login'
              style={{
                fontSize: 14,
                color: '#1677ff',
                textDecoration: 'none',
                fontWeight: 400,
                padding: '4px 8px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            >
              登录
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default SimpleHeader;
