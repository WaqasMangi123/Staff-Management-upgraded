import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminAlert.css';

const AdminAlertsManagement = () => {
  const [alerts, setAlerts] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('all'); // 'all', 'create', 'broadcast', 'stats'
  const [formData, setFormData] = useState({
    type: 'general',
    userId: '',
    title: '',
    message: '',
    priority: 'medium',
    actionRequired: false,
    actionUrl: '',
    expiresInDays: 7
  });
  const [broadcastData, setBroadcastData] = useState({
    type: 'general',
    title: '',
    message: '',
    priority: 'medium',
    department: '',
    actionRequired: false,
    actionUrl: '',
    expiresInDays: 7
  });
  const navigate = useNavigate();

  // Use full URL to backend - same as your working Leave Management
  const API_BASE = 'http://localhost:5000';

  const alertTypes = ['general', 'shift_reminder', 'task_assigned', 'swap_request', 'emergency_cleanup', 'attendance_missing'];
  const priorities = ['low', 'medium', 'high', 'urgent'];
  const departments = ['Cleaning Staff', 'Event Helpers', 'Tea and Snack Staff', 'Maintenance Staff', 'Outdoor Cleaners', 'Office Helpers'];

  useEffect(() => {
    const adminToken = localStorage.getItem('adminToken');
    
    if (!adminToken) {
      alert('Admin access required');
      navigate('/admin/login');
      return;
    }

    loadData();
  }, [navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const adminToken = localStorage.getItem('adminToken');
      
      // Load alerts - using fetch like your working code
      const alertsResponse = await fetch(`${API_BASE}/api/alerts/admin/all`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Load users - using the same working endpoint as Leave Management
      const usersResponse = await fetch(`${API_BASE}/api/auth/users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Load stats
      const statsResponse = await fetch(`${API_BASE}/api/alerts/admin/statistics`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Alerts Response Status:', alertsResponse.status);
      console.log('Users Response Status:', usersResponse.status);
      console.log('Stats Response Status:', statsResponse.status);

      if (!alertsResponse.ok) {
        throw new Error(`Alerts API failed: HTTP ${alertsResponse.status}: ${alertsResponse.statusText}`);
      }

      if (!usersResponse.ok) {
        throw new Error(`Users API failed: HTTP ${usersResponse.status}: ${usersResponse.statusText}`);
      }

      if (!statsResponse.ok) {
        throw new Error(`Stats API failed: HTTP ${statsResponse.status}: ${statsResponse.statusText}`);
      }

      const alertsData = await alertsResponse.json();
      const usersData = await usersResponse.json();
      const statsData = await statsResponse.json();

      console.log('Alerts Data:', alertsData);
      console.log('Users Data:', usersData);
      console.log('Stats Data:', statsData);

      if (alertsData.success) {
        setAlerts(alertsData.alerts || []);
      } else {
        setError(alertsData.message || 'Failed to fetch alerts');
      }

      if (usersData.success) {
        console.log('Users data structure:', usersData.users);
        setUsers(usersData.users || []);
      } else {
        setError(usersData.message || 'Failed to fetch users');
      }

      if (statsData.success) {
        setStats(statsData.stats || {});
      } else {
        console.warn('Failed to fetch stats:', statsData.message);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      setError(`Failed to load data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const createAlert = async (e) => {
    e.preventDefault();
    try {
      const adminToken = localStorage.getItem('adminToken');
      console.log('Creating alert with data:', formData);
      
      const response = await fetch(`${API_BASE}/api/alerts/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log('Create alert response:', data);
      
      if (data.success) {
        alert('Alert created successfully');
        setFormData({
          type: 'general', userId: '', title: '', message: '',
          priority: 'medium', actionRequired: false, actionUrl: '', expiresInDays: 7
        });
        loadData();
      } else {
        alert(data.message || 'Failed to create alert');
      }
    } catch (error) {
      console.error('Create alert error:', error);
      setError(`Failed to create alert: ${error.message}`);
    }
  };

  const broadcastAlert = async (e) => {
    e.preventDefault();
    try {
      const adminToken = localStorage.getItem('adminToken');
      console.log('Broadcasting alert with data:', broadcastData);
      
      const response = await fetch(`${API_BASE}/api/alerts/broadcast`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(broadcastData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log('Broadcast alert response:', data);
      
      if (data.success) {
        alert('Alert broadcasted successfully');
        setBroadcastData({
          type: 'general', title: '', message: '', priority: 'medium',
          department: '', actionRequired: false, actionUrl: '', expiresInDays: 7
        });
        loadData();
      } else {
        alert(data.message || 'Failed to broadcast alert');
      }
    } catch (error) {
      console.error('Broadcast alert error:', error);
      setError(`Failed to broadcast alert: ${error.message}`);
    }
  };

  const cleanupExpired = async () => {
    try {
      const adminToken = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE}/api/alerts/admin/cleanup-expired`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      alert(data.message || 'Expired alerts cleaned up');
      loadData();
    } catch (error) {
      console.error('Cleanup error:', error);
      setError(`Failed to cleanup expired alerts: ${error.message}`);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="alerts-management">
      {/* Header */}
      <div className="alerts-header">
        <h1>Alert Management</h1>
        <div className="header-buttons">
          <button onClick={loadData} className="header-btn btn-refresh">
            Refresh
          </button>
          <button onClick={() => navigate('/admin/dashboard')} className="header-btn btn-back">
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="nav-tabs">
        <button 
          onClick={() => setView('all')}
          className={`nav-tab ${view === 'all' ? 'active' : ''}`}
        >
          All Alerts ({alerts.length})
        </button>
        <button 
          onClick={() => setView('create')}
          className={`nav-tab ${view === 'create' ? 'active' : ''}`}
        >
          Create Alert
        </button>
        <button 
          onClick={() => setView('broadcast')}
          className={`nav-tab ${view === 'broadcast' ? 'active' : ''}`}
        >
          Broadcast Alert
        </button>
        <button 
          onClick={() => setView('stats')}
          className={`nav-tab ${view === 'stats' ? 'active' : ''}`}
        >
          Statistics
        </button>
      </div>

      {/* Debug Info */}
      <div className="debug-info">
        <div>API Base: {API_BASE}</div>
        <div>Users loaded: {users.length}</div>
        <div>Alerts loaded: {alerts.length}</div>
        <div>Loading: {loading ? 'Yes' : 'No'}</div>
      </div>

      {/* All Alerts View */}
      {view === 'all' && (
        <div className="content-card">
          <div className="card-header">
            <span>All Alerts ({alerts.length})</span>
            <button onClick={cleanupExpired} className="cleanup-btn">
              Cleanup Expired
            </button>
          </div>
          
          {loading ? (
            <div className="loading-state">
              <div>Loading alerts...</div>
            </div>
          ) : alerts.length === 0 ? (
            <div className="empty-state">
              <div className="icon">📋</div>
              <div className="title">No alerts found</div>
              <div className="description">Create your first alert using the tabs above</div>
            </div>
          ) : (
            <div>
              {alerts.map((alert, index) => (
                <div key={alert._id} className="alert-item">
                  <div className="alert-grid">
                    <div className="alert-main">
                      <div className="alert-title">{alert.title}</div>
                      <div className="alert-recipient">
                        To: {alert.userId?.username || alert.userId?.name || 'Unknown User'}
                      </div>
                      <div className="alert-message">{alert.message}</div>
                    </div>
                    <div className="alert-meta">
                      <div><strong>Type:</strong> {alert.type}</div>
                      <div>
                        <strong>Priority:</strong>
                        <span className={`priority-badge priority-${alert.priority}`}>
                          {alert.priority}
                        </span>
                      </div>
                    </div>
                    <div className="alert-meta">
                      <div><strong>Status:</strong> {alert.isRead ? '✅ Read' : '❌ Unread'}</div>
                      <div><strong>Created:</strong> {formatTime(alert.createdAt)}</div>
                    </div>
                    <div className="alert-meta">
                      <div><strong>Expires:</strong> {formatDate(alert.expiresAt)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Alert View */}
      {view === 'create' && (
        <div className="form-container">
          <h2 className="form-title">Create Single Alert</h2>
          <form onSubmit={createAlert}>
            <div className="form-group">
              <label className="form-label">Type:</label>
              <select 
                value={formData.type} 
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                className="form-select"
              >
                {alertTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">User:</label>
              <select 
                value={formData.userId} 
                onChange={(e) => setFormData({...formData, userId: e.target.value})} 
                required
                className="form-select"
              >
                <option value="">Select User ({users.length} available)</option>
                {users.map(user => (
                  <option key={user._id || user.id} value={user._id || user.id}>
                    {user.username || user.name} {user.email && `(${user.email})`}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Title:</label>
              <input 
                type="text" 
                value={formData.title} 
                onChange={(e) => setFormData({...formData, title: e.target.value})} 
                required 
                placeholder="Enter alert title"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Message:</label>
              <textarea 
                value={formData.message} 
                onChange={(e) => setFormData({...formData, message: e.target.value})} 
                required 
                rows="4"
                placeholder="Enter alert message"
                className="form-textarea"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Priority:</label>
              <select 
                value={formData.priority} 
                onChange={(e) => setFormData({...formData, priority: e.target.value})}
                className="form-select"
              >
                {priorities.map(priority => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
            </div>

            <div className="form-checkbox-group">
              <input 
                type="checkbox" 
                checked={formData.actionRequired} 
                onChange={(e) => setFormData({...formData, actionRequired: e.target.checked})}
                className="form-checkbox"
                id="actionRequired"
              />
              <label htmlFor="actionRequired" className="form-checkbox-label">Action Required</label>
            </div>

            <div className="form-group">
              <label className="form-label">Action URL (optional):</label>
              <input 
                type="text" 
                value={formData.actionUrl} 
                onChange={(e) => setFormData({...formData, actionUrl: e.target.value})} 
                placeholder="https://example.com"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Expires in (days):</label>
              <input 
                type="number" 
                value={formData.expiresInDays} 
                onChange={(e) => setFormData({...formData, expiresInDays: parseInt(e.target.value)})} 
                min="1"
                max="365"
                className="form-input"
              />
            </div>

            <button type="submit" className="form-submit btn-create">
              Create Alert
            </button>
          </form>
        </div>
      )}

      {/* Broadcast Alert View */}
      {view === 'broadcast' && (
        <div className="form-container">
          <h2 className="form-title">Broadcast Alert to Multiple Users</h2>
          <form onSubmit={broadcastAlert}>
            <div className="form-group">
              <label className="form-label">Type:</label>
              <select 
                value={broadcastData.type} 
                onChange={(e) => setBroadcastData({...broadcastData, type: e.target.value})}
                className="form-select"
              >
                {alertTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Title:</label>
              <input 
                type="text" 
                value={broadcastData.title} 
                onChange={(e) => setBroadcastData({...broadcastData, title: e.target.value})} 
                required 
                placeholder="Enter broadcast title"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Message:</label>
              <textarea 
                value={broadcastData.message} 
                onChange={(e) => setBroadcastData({...broadcastData, message: e.target.value})} 
                required 
                rows="4"
                placeholder="Enter broadcast message"
                className="form-textarea"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Department (leave empty for all):</label>
              <select 
                value={broadcastData.department} 
                onChange={(e) => setBroadcastData({...broadcastData, department: e.target.value})}
                className="form-select"
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Priority:</label>
              <select 
                value={broadcastData.priority} 
                onChange={(e) => setBroadcastData({...broadcastData, priority: e.target.value})}
                className="form-select"
              >
                {priorities.map(priority => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
            </div>

            <div className="form-checkbox-group">
              <input 
                type="checkbox" 
                checked={broadcastData.actionRequired} 
                onChange={(e) => setBroadcastData({...broadcastData, actionRequired: e.target.checked})}
                className="form-checkbox"
                id="broadcastActionRequired"
              />
              <label htmlFor="broadcastActionRequired" className="form-checkbox-label">Action Required</label>
            </div>

            <button type="submit" className="form-submit btn-broadcast">
              Broadcast Alert
            </button>
          </form>
        </div>
      )}

      {/* Statistics View */}
      {view === 'stats' && (
        <div className="stats-container">
          <h2 className="stats-title">Alert Statistics</h2>
          
          <div className="stats-overview">
            <h3>Totals (Last 7 Days)</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-number primary">{stats.totals?.created || 0}</div>
                <div className="stat-label">Created</div>
              </div>
              <div className="stat-item">
                <div className="stat-number success">{stats.totals?.read || 0}</div>
                <div className="stat-label">Read</div>
              </div>
              <div className="stat-item">
                <div className="stat-number warning">{stats.totals?.unread || 0}</div>
                <div className="stat-label">Unread</div>
              </div>
              <div className="stat-item">
                <div className="stat-number danger">{stats.totals?.expired || 0}</div>
                <div className="stat-label">Expired</div>
              </div>
              <div className="stat-item">
                <div className="stat-number purple">{stats.readRate || 0}%</div>
                <div className="stat-label">Read Rate</div>
              </div>
            </div>
          </div>

          {Object.keys(stats.byType || {}).length > 0 && (
            <div className="stats-section">
              <h3>By Type</h3>
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Total</th>
                    <th>Read</th>
                    <th>Unread</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(stats.byType || {}).map(([type, data]) => (
                    <tr key={type}>
                      <td>{type}</td>
                      <td>{data.total}</td>
                      <td>{data.read}</td>
                      <td>{data.unread}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {Object.keys(stats.byPriority || {}).length > 0 && (
            <div className="stats-section">
              <h3>By Priority</h3>
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Priority</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(stats.byPriority || {}).map(([priority, count]) => (
                    <tr key={priority}>
                      <td>{priority}</td>
                      <td>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminAlertsManagement;