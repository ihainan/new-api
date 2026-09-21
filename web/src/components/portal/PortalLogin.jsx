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

import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import {
  API,
  getSystemName,
  onDingTalkOAuthClicked,
  setUserData,
  showError,
  showSuccess,
  updateAPI,
} from '../../helpers';
import TwoFAVerification from '../auth/TwoFAVerification';
import BrandMark from './BrandMark';
import { usePortalT } from './shared';
import './portal.css';

/*
 * 登录页。这里只留两条路：钉钉扫码（员工），以及用户名密码（管理员）。
 * 上游那个登录页把微信、Telegram、GitHub、Discord、LinuxDO 等一并摆出来，
 * 本部署一个都没开，摆着只会让人挨个试。
 *
 * 2FA 仍然接上游那个组件：管理员账号可能开了两步验证，不接就登不进去。
 */
export default function PortalLogin() {
  const t = usePortalT();
  const navigate = useNavigate();
  const [, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const status = statusState?.status || {};

  const [admin, setAdmin] = useState(false);
  const [twoFA, setTwoFA] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const systemName = getSystemName();
  const dingtalk = !!status.dingtalk_oauth;

  // 已登录的人进不到这一页：AuthRedirect 会先把他送回控制台，
  // 所以这里不用再处理「已登录」的情形。

  useEffect(() => {
    document.title = `${t('登录')} · ${systemName}`;
  }, [t, systemName]);

  const finishLogin = (data) => {
    userDispatch({ type: 'login', payload: data });
    setUserData(data);
    updateAPI();
    // 管理员落在原来的登录落地页（和改版前的 LoginForm 一致），员工进门户概览
    navigate(data?.role >= 10 ? '/console/token' : '/console/dashboard');
  };

  const handleDingTalk = () => {
    onDingTalkOAuthClicked(status.dingtalk_client_id, status.server_address, {
      shouldLogout: true,
    });
  };

  const handleAdminLogin = async (e) => {
    e?.preventDefault?.();
    if (!username || !password) {
      showError(t('请输入用户名和密码'));
      return;
    }
    setLoading(true);
    try {
      const res = await API.post('/api/user/login', { username, password });
      const { success, message, data } = res.data;
      if (!success) {
        showError(message || t('登录失败'));
        return;
      }
      if (data?.require_2fa) {
        setTwoFA(true);
        return;
      }
      showSuccess(t('登录成功'));
      finishLogin(data);
    } catch (err) {
      showError(t('登录失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='pt-login'>
      <div className='pt-login-box'>
        <div className='pt-login-brand'>
          <BrandMark size={30} plain />
          <span className='pt-login-name'>{systemName}</span>
        </div>

        <div className='pt-login-card'>
          {twoFA ? (
            <>
              <h1 className='pt-login-title'>{t('两步验证')}</h1>
              <p className='pt-login-hint'>
                {t('请输入认证器应用显示的验证码完成登录。')}
              </p>
              <TwoFAVerification
                onSuccess={finishLogin}
                onBack={() => setTwoFA(false)}
              />
            </>
          ) : admin ? (
            <>
              <h1 className='pt-login-title'>{t('管理员登录')}</h1>
              <p className='pt-login-hint'>{t('仅限管理员账号。')}</p>
              <form onSubmit={handleAdminLogin}>
                <input
                  className='pt-login-input'
                  placeholder={t('用户名')}
                  autoComplete='username'
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <input
                  className='pt-login-input'
                  type='password'
                  placeholder={t('密码')}
                  autoComplete='current-password'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type='submit'
                  className='pt-btn primary pt-login-submit'
                  disabled={loading}
                >
                  {loading ? t('登录中…') : t('登录')}
                </button>
              </form>
              {dingtalk ? (
                <div className='pt-login-alt'>
                  <button
                    type='button'
                    className='pt-login-link'
                    onClick={() => setAdmin(false)}
                  >
                    {t('返回钉钉登录')}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <h1 className='pt-login-title'>{t('登录')}</h1>
              <p className='pt-login-hint'>
                {t('使用企业钉钉扫码，在职成员自动开通访问。')}
              </p>
              <button
                type='button'
                className='pt-btn primary pt-login-submit'
                onClick={handleDingTalk}
                disabled={!dingtalk}
              >
{dingtalk ? t('钉钉扫码登录') : t('钉钉登录未开启')}
              </button>
              <div className='pt-login-alt'>
                <button
                  type='button'
                  className='pt-login-link'
                  onClick={() => setAdmin(true)}
                >
                  {t('管理员登录')}
                </button>
              </div>
            </>
          )}
        </div>

        <p className='pt-login-foot'>{t('内部系统 · 密钥请勿外传')}</p>
      </div>
    </div>
  );
}
