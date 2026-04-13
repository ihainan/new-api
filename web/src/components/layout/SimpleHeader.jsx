import React, { useContext, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Dropdown } from '@douyinfe/semi-ui';
import { UserContext } from '../../context/User';
import { API, getLogo, getSystemName, stringToColor } from '../../helpers';
import './SimpleHeader.css';

/* ── SVG 图标（AIHubMix 原版路径） ── */

const IconModels = () => (
  <svg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <path d='M6.625 10.333a2.31 2.31 0 0 1-.65-.608 2.31 2.31 0 0 1-.309-.724L1.577 7.679a.223.223 0 0 1 0-.358l4.09-1.055c.23-.06.44-.18.609-.348.168-.169.288-.379.348-.609L7.679 1.577a.223.223 0 0 1 .322-.136.223.223 0 0 1 .036.136l1.054 4.09c.06.23.18.44.348.609.169.168.379.288.609.348l4.09 1.054a.223.223 0 0 1 0 .322l-4.09 1.055a2.31 2.31 0 0 0-.957.957l-1.055 4.09a.223.223 0 0 1-.322.136.223.223 0 0 1-.036-.136L6.625 10.333Z'
      stroke='currentColor' strokeLinecap='round' strokeLinejoin='round'/>
    <path d='M13.333 2v2.667M14.667 3.333H12M2.667 11.333v1.334M3.333 12H2'
      stroke='currentColor' strokeLinecap='round' strokeLinejoin='round'/>
  </svg>
);

const IconPlayground = () => (
  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <path d='M16 13l5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5'
      stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'/>
    <path d='M14 6H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2Z'
      stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'/>
  </svg>
);

const IconKey = () => (
  <svg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <path d='M10.333 5l1.534 1.533c.248.248.649.248.933 0l1.4-1.4a.667.667 0 0 0 0-.933L12.667 2.667'
      stroke='currentColor' strokeLinecap='round' strokeLinejoin='round'/>
    <path d='M14 1.333L7.6 7.733' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round'/>
    <path d='M5 14a3.333 3.333 0 1 0 0-6.667A3.333 3.333 0 0 0 5 14Z'
      stroke='currentColor' strokeLinecap='round' strokeLinejoin='round'/>
  </svg>
);

/* ── 单条导航链接 ── */
const NavItem = ({ to, label, icon, currentPath }) => {
  const isActive = to === '/' ? currentPath === '/' : currentPath.startsWith(to);
  return (
    <Link to={to} className={`aihub-nav-item${isActive ? ' active' : ''}`}>
      {icon}
      <span>{label}</span>
    </Link>
  );
};

/* ── 主组件 ── */
const SimpleHeader = () => {
  const [userState, userDispatch] = useContext(UserContext);
  const location = useLocation();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

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
    /* 外层：sticky，透明背景，提供上下左右边距 */
    <div className='aihub-header-wrap'>

      {/* 药丸本体：居中，白色，圆角，有阴影 */}
      <div className='aihub-pill'>

        {/* 左侧：圆形 Logo + 产品名 */}
        <Link to='/' className='aihub-logo'>
          <img src={logo} alt='logo' />
          <h1>{systemName}</h1>
        </Link>

        {/* 中间：导航项（flex-1 撑满） */}
        <nav className='aihub-nav'>
          <NavItem to='/'                   label='Models'      icon={<IconModels />}     currentPath={currentPath} />
          <NavItem to='/console/playground' label='Playground'  icon={<IconPlayground />} currentPath={currentPath} />
          <NavItem to='/console/token'      label='Keys'        icon={<IconKey />}        currentPath={currentPath} />
        </nav>

        {/* 右侧：登录 或 用户头像+名字 */}
        <div className='aihub-right' ref={dropdownRef}>
          {user ? (
            <Dropdown
              position='bottomRight'
              getPopupContainer={() => dropdownRef.current}
              render={
                <Dropdown.Menu>
                  <Dropdown.Item onClick={logout}>退出登录</Dropdown.Item>
                </Dropdown.Menu>
              }
            >
              <div className='aihub-user'>
                <span className='aihub-avatar' style={{ backgroundColor: stringToColor(user.username) }}>
                  {user.username[0].toUpperCase()}
                </span>
                <span className='aihub-username'>{user.username}</span>
              </div>
            </Dropdown>
          ) : (
            <Link to='/login' className='aihub-sign-in'>登录</Link>
          )}
        </div>

      </div>
    </div>
  );
};

export default SimpleHeader;
