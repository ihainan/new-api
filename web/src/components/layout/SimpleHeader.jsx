import React, { useContext, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Dropdown } from '@douyinfe/semi-ui';
import { UserContext } from '../../context/User';
import { API, getLogo, getSystemName } from '../../helpers';
import './SimpleHeader.css';

/* ── 可爱平面头像生成器 ── */
function strHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}

const PALETTES = [
  { bg: '#FFADAD', skin: '#FFD0D0', ink: '#C94040' },
  { bg: '#FFD6A5', skin: '#FFE8C8', ink: '#C97A20' },
  { bg: '#CAFFBF', skin: '#DFFFDA', ink: '#2E8A3A' },
  { bg: '#9BF6FF', skin: '#C8FBFF', ink: '#1A8FA0' },
  { bg: '#A0C4FF', skin: '#C8DEFF', ink: '#2255BB' },
  { bg: '#BDB2FF', skin: '#D8D2FF', ink: '#5533CC' },
  { bg: '#FFC6FF', skin: '#FFE0FF', ink: '#AA33AA' },
  { bg: '#FDFFB6', skin: '#FFFFD8', ink: '#A09010' },
];

/* expression paths — all relative to 40×40 viewBox */
const EXPRESSIONS = [
  // 0: happy smile
  (ink) => (
    <>
      <circle cx='14.5' cy='17' r='2.2' fill={ink} />
      <circle cx='25.5' cy='17' r='2.2' fill={ink} />
      <path d='M13 23 Q20 28.5 27 23' stroke={ink} strokeWidth='2' strokeLinecap='round' fill='none' />
    </>
  ),
  // 1: sleepy (line eyes + tiny mouth)
  (ink) => (
    <>
      <path d='M11.5 16.5 Q14.5 14.5 17.5 16.5' stroke={ink} strokeWidth='2' strokeLinecap='round' fill='none' />
      <path d='M22.5 16.5 Q25.5 14.5 28.5 16.5' stroke={ink} strokeWidth='2' strokeLinecap='round' fill='none' />
      <path d='M17 24.5 Q20 26.5 23 24.5' stroke={ink} strokeWidth='1.8' strokeLinecap='round' fill='none' />
    </>
  ),
  // 2: surprised (round mouth)
  (ink) => (
    <>
      <circle cx='14.5' cy='17' r='2.8' fill={ink} />
      <circle cx='25.5' cy='17' r='2.8' fill={ink} />
      <ellipse cx='20' cy='25' rx='3.5' ry='2.8' fill={ink} />
    </>
  ),
  // 3: cool (sunglasses)
  (ink) => (
    <>
      <rect x='10' y='14' width='8' height='5.5' rx='2.5' fill={ink} />
      <rect x='22' y='14' width='8' height='5.5' rx='2.5' fill={ink} />
      <line x1='18' y1='16.5' x2='22' y2='16.5' stroke={ink} strokeWidth='1.5' />
      <path d='M13.5 24 Q20 28 26.5 24' stroke={ink} strokeWidth='2' strokeLinecap='round' fill='none' />
    </>
  ),
  // 4: wink
  (ink) => (
    <>
      <circle cx='14.5' cy='17' r='2.2' fill={ink} />
      <path d='M22.5 15.5 Q25.5 17.5 28.5 15.5' stroke={ink} strokeWidth='2' strokeLinecap='round' fill='none' />
      <path d='M13 23 Q20 28.5 27 23' stroke={ink} strokeWidth='2' strokeLinecap='round' fill='none' />
    </>
  ),
  // 5: star eyes
  (ink) => (
    <>
      <text x='14.5' y='21' fontSize='9' fill={ink} textAnchor='middle' dominantBaseline='middle'>★</text>
      <text x='25.5' y='21' fontSize='9' fill={ink} textAnchor='middle' dominantBaseline='middle'>★</text>
      <path d='M12.5 26 Q20 31 27.5 26' stroke={ink} strokeWidth='2.2' strokeLinecap='round' fill='none' />
    </>
  ),
];

const ACCESSORIES = [
  // 0: none
  () => null,
  // 1: cat ears
  (bg, ink) => (
    <>
      <polygon points='7,12 13,20 4,22' fill={bg} stroke={ink} strokeWidth='1.2' />
      <polygon points='33,12 27,20 36,22' fill={bg} stroke={ink} strokeWidth='1.2' />
    </>
  ),
  // 2: bunny ears
  (bg, ink) => (
    <>
      <ellipse cx='13' cy='5' rx='3' ry='7' fill={bg} stroke={ink} strokeWidth='1.2' />
      <ellipse cx='27' cy='5' rx='3' ry='7' fill={bg} stroke={ink} strokeWidth='1.2' />
    </>
  ),
  // 3: mini crown
  (bg, ink) => (
    <polygon
      points='12,14 16,8 20,12 24,8 28,14'
      fill='#FFD700'
      stroke='#C8A000'
      strokeWidth='1'
      strokeLinejoin='round'
    />
  ),
];

const CuteAvatar = ({ username, size = 28 }) => {
  const h = strHash(username || '?');
  const { bg, skin, ink } = PALETTES[h % PALETTES.length];
  const expr = EXPRESSIONS[(h >> 4) % EXPRESSIONS.length];
  const acc = ACCESSORIES[(h >> 8) % ACCESSORIES.length];

  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 40 40'
      xmlns='http://www.w3.org/2000/svg'
      style={{ flexShrink: 0, borderRadius: '50%', display: 'block' }}
    >
      {/* background circle */}
      <circle cx='20' cy='20' r='20' fill={bg} />
      {/* accessory (drawn behind face) */}
      {acc && acc(bg, ink)}
      {/* face circle */}
      <circle cx='20' cy='21' r='13' fill={skin} />
      {/* expression */}
      {expr(ink)}
    </svg>
  );
};

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
                <CuteAvatar username={user.username} size={28} />
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
