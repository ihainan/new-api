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
import { Navigate } from 'react-router-dom';
import PortalOverview from '../../components/portal/PortalOverview';
import { isAdmin } from '../../helpers/utils.jsx';

// /console/dashboard 是员工门户的概览。管理员走到这里（旧书签、手敲地址）
// 就送回管理后台自己的数据看板，不让他落进员工门户。
const UserDashboard = () =>
  isAdmin() ? <Navigate to='/console' replace /> : <PortalOverview />;

export default UserDashboard;
