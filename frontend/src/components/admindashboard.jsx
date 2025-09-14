import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState({
    totalStaff: 0,
    activeSchedules: 0,
    pendingTasks: 0,
    unreadAlerts: 0,
    pendingLeaves: 0,
    systemStatus: 'online'
  });
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminAuth();
    loadDashboardStats();
  }, []);

  const checkAdminAuth = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        navigate('/admin-login');
        return;
      }

      const response = await axios.get('http://localhost:5000/api/admin/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setAdmin(response.data.admin);
      } else {
        throw new Error('Invalid admin session');
      }
    } catch (error) {
      console.error('Admin auth check failed:', error);
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminData');
      navigate('/admin-login');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardStats = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return;

      const [staffRes, alertsRes, leavesRes, tasksRes] = await Promise.allSettled([
        axios.get('http://localhost:5000/api/admin/all-staff', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        axios.get('http://localhost:5000/api/alerts/admin/statistics', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        axios.get('http://localhost:5000/api/auth/attendance/admin/pending-leaves', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        axios.get('http://localhost:5000/api/tasks/admin/all', {
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => ({ value: { data: { success: false } } }))
      ]);

      const stats = {
        totalStaff: 0,
        activeSchedules: 0,
        pendingTasks: 0,
        unreadAlerts: 0,
        pendingLeaves: 0,
        systemStatus: 'online'
      };

      if (staffRes.status === 'fulfilled' && staffRes.value.data.success) {
        stats.totalStaff = staffRes.value.data.staff?.length || 0;
      }

      if (alertsRes.status === 'fulfilled' && alertsRes.value.data.success) {
        stats.unreadAlerts = alertsRes.value.data.stats?.totals?.unread || 0;
      }

      if (leavesRes.status === 'fulfilled' && leavesRes.value.data.success) {
        stats.pendingLeaves = leavesRes.value.data.pendingLeaves?.length || 0;
      }

      if (tasksRes.status === 'fulfilled' && tasksRes.value.data.success) {
        const tasks = tasksRes.value.data.tasks || [];
        stats.pendingTasks = tasks.filter(task => task.status === 'pending').length;
        stats.activeSchedules = tasks.length;
      }

      setDashboardStats(stats);
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    }
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('adminToken');

      if (token) {
        await axios.post('http://localhost:5000/api/admin/logout', {}, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }

      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminData');
      toast.success('Logged out successfully!');
      navigate('/admin-login');
    } catch (error) {
      console.error('Logout error:', error);
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminData');
      navigate('/admin-login');
    }
  };

  const managementSections = [
    {
      id: 'staff',
      title: 'Staff Management',
      icon: '👤',
      description: 'Comprehensive staff management system to handle all employee operations, profiles, and department assignments.',
      features: ['Add New Staff', 'Edit Profiles', 'Department Management', 'Advanced Search'],
      route: '/admin-management-staff',
      color: '#10b981'
    },
    {
      id: 'schedules',
      title: 'Schedule Management',
      icon: '📋',
      description: 'Create and manage staff schedules, track working hours, and handle shift assignments efficiently.',
      features: ['Create Schedules', 'Bulk Operations', 'Shift Planning', 'Time Tracking'],
      route: '/admin/schedule',
      color: '#0ea5e9'
    },
    {
      id: 'tasks',
      title: 'Task Management',
      icon: '✏️',
      description: 'Assign tasks, monitor progress, set priorities, and ensure timely completion across all departments.',
      features: ['Task Assignment', 'Progress Tracking', 'Priority Settings', 'Team Collaboration'],
      route: '/admin/tasks',
      color: '#eab308'
    },
    {
      id: 'leaves',
      title: 'Leave Management',
      icon: '📅',
      description: 'Streamline leave request approvals, track attendance records, and generate comprehensive reports.',
      features: ['Approve Requests', 'Attendance Records', 'Leave History', 'Custom Reports'],
      route: '/admin-leave-management',
      color: '#8b5cf6'
    },
    {
      id: 'alerts',
      title: 'Alert Management',
      icon: '🔔',
      description: 'Send targeted alerts, broadcast important messages, and maintain effective communication channels.',
      features: ['Send Alerts', 'Broadcast Messages', 'Priority Management', 'Analytics Dashboard'],
      route: '/admin/alerts',
      color: '#ef4444'
    },
    {
      id: 'performance',
      title: 'Performance Reports',
      icon: '📊',
      description: 'Generate detailed performance analytics, create custom reports, and track productivity metrics.',
      features: ['Performance Analytics', 'Custom Reports', 'Data Visualization', 'Export Options'],
      route: '/admin/performance',
      color: '#06b6d4'
    }
  ];

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading Dashboard...</div>
        </div>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="admin-dashboard">
        <div className="loading-container">
          <div className="loading-text">Redirecting to Login...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-container">
        {/* Header Section */}
        <header className="dashboard-header">
          <div className="header-left">
            <h1>Admin Dashboard</h1>
            <p className="subtitle">Comprehensive Management System</p>
          </div>
          <div className="header-right">
            <div className="admin-info">
              <h3>Welcome, {admin.username}</h3>
              <p><strong>Email:</strong> {admin.email}</p>
              <p><strong>Role:</strong> {admin.role}</p>
              <p><strong>Last Login:</strong> {admin.lastLogin ? new Date(admin.lastLogin).toLocaleDateString() : 'First Time'}</p>
            </div>
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        {/* Stats Overview */}
        <section className="stats-overview">
          <div className="stat-card staff">
            <div className="stat-icon">👥</div>
            <div className="stat-number">{dashboardStats.totalStaff}</div>
            <div className="stat-label">Total Staff Members</div>
            <div className="stat-change positive">Active Personnel</div>
          </div>
          
          <div className="stat-card schedules">
            <div className="stat-icon">📋</div>
            <div className="stat-number">{dashboardStats.activeSchedules}</div>
            <div className="stat-label">Active Schedules</div>
            <div className="stat-change positive">Currently Running</div>
          </div>
          
          <div className="stat-card tasks">
            <div className="stat-icon">⏳</div>
            <div className="stat-number">{dashboardStats.pendingTasks}</div>
            <div className="stat-label">Pending Tasks</div>
            <div className="stat-change warning">Need Attention</div>
          </div>
          
          <div className="stat-card alerts">
            <div className="stat-icon">🔔</div>
            <div className="stat-number">{dashboardStats.unreadAlerts}</div>
            <div className="stat-label">Unread Alerts</div>
            <div className="stat-change negative">Requires Review</div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="quick-actions">
          <h2>Quick Actions</h2>
          <div className="quick-actions-grid">
            <button 
              className="quick-action-btn primary"
              onClick={() => navigate('/admin-management-staff')}
            >
              Add New Staff Member
            </button>
            <button 
              className="quick-action-btn success"
              onClick={() => navigate('/admin/schedule')}
            >
              Create New Schedule
            </button>
            <button 
              className="quick-action-btn warning"
              onClick={() => navigate('/admin-leave-management')}
            >
              Review Leave Requests ({dashboardStats.pendingLeaves})
            </button>
            <button 
              className="quick-action-btn danger"
              onClick={() => navigate('/admin/alerts')}
            >
              Send Priority Alert
            </button>
          </div>
        </section>

        {/* Management Sections */}
        <section className="management-sections">
          {managementSections.map((section) => (
            <div key={section.id} className="management-card">
              <div className="card-header">
                <div className="card-icon" style={{ backgroundColor: `${section.color}15`, color: section.color }}>
                  {section.icon}
                </div>
                <h3 className="card-title">{section.title}</h3>
              </div>
              
              <p className="card-description">{section.description}</p>
              
              <div className="card-features">
                <h4>Key Features</h4>
                <ul className="feature-list">
                  {section.features.map((feature, index) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>
              </div>
              
              <button 
                className="manage-btn"
                onClick={() => navigate(section.route)}
                style={{ background: `linear-gradient(135deg, ${section.color} 0%, ${section.color}dd 100%)` }}
              >
                Open {section.title.replace(' Management', '')}
              </button>
            </div>
          ))}
        </section>

        {/* System Status */}
        <section className="system-status">
          <h2>System Health Monitor</h2>
          <div className="status-grid">
            <div className="status-item">
              <div className="status-indicator online"></div>
              <div className="status-label">API Gateway</div>
              <div className="status-value">Operational</div>
            </div>
            
            <div className="status-item">
              <div className="status-indicator online"></div>
              <div className="status-label">Database</div>
              <div className="status-value">Connected</div>
            </div>
            
            <div className="status-item">
              <div className="status-indicator online"></div>
              <div className="status-label">Authentication</div>
              <div className="status-value">Secure</div>
            </div>
            
            <div className="status-item">
              <div className="status-indicator warning"></div>
              <div className="status-label">Notification Service</div>
              <div className="status-value">Processing Queue</div>
            </div>
            
            <div className="status-item">
              <div className="status-indicator online"></div>
              <div className="status-label">File Storage</div>
              <div className="status-value">Available</div>
            </div>
            
            <div className="status-item">
              <div className="status-indicator online"></div>
              <div className="status-label">Backup System</div>
              <div className="status-value">Last: Today</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;