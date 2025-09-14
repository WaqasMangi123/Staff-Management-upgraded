import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/home';
import Login from './components/login';
import Register from './components/register';
import EmailVerification from './components/emailverification';
import ResetPassword from './components/resetpassword';
import ForgetPassword from './components/forgetpassword';
import HomeSecond from './components/homee';
import UserHome from './components/userhome';
import UserProfile from './components/userprofile';
import UserAttendance from './components/userattendance';

// New User Pages
import UserSchedule from './components/userschedule';
import UserTasks from './components/usertask';
import UserShiftSwap from './components/usershiftswap';
import UserPerformance from './components/userperformance';
import UserAlerts from './components/useralert';

import AdminLogin from './components/adminlogin';
import AdminDashboard from './components/admindashboard';
import AdminManagementStaff from './components/adminstaffmanagement';
import AdminLeaveManagement from './components/adminleavemanagement';

// New Admin Pages
import AdminScheduleManagement from './components/adminschedule';
import AdminTaskManagement from './components/admintask';
import AdminShiftSwapManagement from './components/adminshiftswap';
import AdminPerformanceManagement from './components/adminperformance';
import AdminAlertsManagement from './components/adminalerts';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* Main Home Page */}
        <Route path="/" element={<Home />} />
        
        {/* Authentication Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/email-verification" element={<EmailVerification />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/forget-password" element={<ForgetPassword />} />
        
        {/* Second Home Page */}
        <Route path="/home-second" element={<HomeSecond />} />
        
        {/* User Routes */}
        <Route path="/user-home" element={<UserHome />} />
        <Route path="/user-profile" element={<UserProfile />} />
        <Route path="/user/attendance" element={<UserAttendance />} />
        <Route path="/user/schedule" element={<UserSchedule />} />
        <Route path="/user/tasks" element={<UserTasks />} />
        <Route path="/user/shift-swap" element={<UserShiftSwap />} />
        <Route path="/user/performance" element={<UserPerformance />} />
        <Route path="/user/alerts" element={<UserAlerts />} />
        
        {/* Admin Routes */}
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin-management-staff" element={<AdminManagementStaff />} />
        <Route path="/admin-leave-management" element={<AdminLeaveManagement />} />
        <Route path="/admin/schedule" element={<AdminScheduleManagement />} />
        <Route path="/admin/tasks" element={<AdminTaskManagement />} />
        <Route path="/admin/shift-swap" element={<AdminShiftSwapManagement />} />
        <Route path="/admin/performance" element={<AdminPerformanceManagement />} />
        <Route path="/admin/alerts" element={<AdminAlertsManagement />} />
      </Routes>
      
      {/* Toast Container for notifications */}
      <ToastContainer />
    </Router>
  );
}

export default App;