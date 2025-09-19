import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const UserAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [groupedAlerts, setGroupedAlerts] = useState({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'urgent', 'high'
  const navigate = useNavigate();
  const API_BASE = 'https://staff-management-upgraded.onrender.com';

  useEffect(() => {
    loadAlerts();
  }, [filter]);

  const loadAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = {};
      if (filter === 'unread') params.isRead = false;
      if (filter === 'urgent') params.priority = 'urgent';
      if (filter === 'high') params.priority = 'high';

      const response = await axios.get(`${API_BASE}/api/alerts/my-alerts`, {
        params,
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.data.success) {
        setAlerts(response.data.alerts);
        setGroupedAlerts(response.data.groupedAlerts);
        setUnreadCount(response.data.unreadCount);
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (alertId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE}/api/alerts/mark-read/${alertId}`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      loadAlerts();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE}/api/alerts/mark-all-read`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      alert('All alerts marked as read');
      loadAlerts();
    } catch (error) {
      alert('Failed to mark all as read');
    }
  };

  const deleteAlert = async (alertId) => {
    if (!window.confirm('Are you sure you want to delete this alert?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE}/api/alerts/delete/${alertId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      loadAlerts();
    } catch (error) {
      console.error('Error deleting alert:', error);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return '#dc3545';
      case 'high': return '#fd7e14';
      case 'medium': return '#ffc107';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  };

  const renderAlert = (alert) => (
    <div key={alert._id} style={{
      border: '1px solid #ddd',
      margin: '10px 0',
      padding: '15px',
      borderRadius: '4px',
      backgroundColor: alert.isRead ? '#f8f9fa' : '#ffffff',
      borderLeft: `4px solid ${getPriorityColor(alert.priority)}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: '0 0 10px 0', color: alert.isRead ? '#6c757d' : '#000' }}>
            {alert.title}
            {!alert.isRead && <span style={{color: '#007bff', fontSize: '12px', marginLeft: '10px'}}>NEW</span>}
          </h4>
          <p style={{ margin: '0 0 10px 0', color: '#666' }}>{alert.message}</p>
          <div style={{ fontSize: '12px', color: '#888' }}>
            <span>Priority: {alert.priority}</span>
            <span style={{ marginLeft: '15px' }}>
              Created: {new Date(alert.createdAt).toLocaleDateString()}
            </span>
            <span style={{ marginLeft: '15px' }}>
              Expires: {new Date(alert.expiresAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div>
          {!alert.isRead && (
            <button onClick={() => markAsRead(alert._id)} style={{
              padding: '5px 10px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              marginRight: '5px',
              fontSize: '12px'
            }}>
              Mark Read
            </button>
          )}
          <button onClick={() => deleteAlert(alert._id)} style={{
            padding: '5px 10px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px'
          }}>
            Delete
          </button>
        </div>
      </div>
      {alert.actionRequired && alert.actionUrl && (
        <div style={{ marginTop: '10px' }}>
          <a href={alert.actionUrl} style={{
            padding: '8px 15px',
            backgroundColor: '#28a745',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '3px',
            fontSize: '12px'
          }}>
            Take Action
          </a>
        </div>
      )}
    </div>
  );

  if (loading) return <div>Loading alerts...</div>;

  return (
    <div>
      <h1>My Alerts ({unreadCount} unread)</h1>
      <button onClick={() => navigate('/user/home')}>Back to Home</button>
      
      <div style={{ margin: '20px 0' }}>
        <button onClick={() => setFilter('all')}>All Alerts</button>
        <button onClick={() => setFilter('unread')}>Unread ({unreadCount})</button>
        <button onClick={() => setFilter('urgent')}>Urgent</button>
        <button onClick={() => setFilter('high')}>High Priority</button>
        {unreadCount > 0 && (
          <button onClick={markAllAsRead} style={{ marginLeft: '20px', backgroundColor: '#28a745', color: 'white' }}>
            Mark All Read
          </button>
        )}
      </div>

      {alerts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔔</div>
          <div>No alerts found</div>
        </div>
      ) : (
        <div>
          {filter === 'all' && Object.keys(groupedAlerts).length > 0 ? (
            // Show grouped alerts when viewing all
            <div>
              {groupedAlerts.urgent && groupedAlerts.urgent.length > 0 && (
                <div>
                  <h2 style={{ color: '#dc3545' }}>Urgent Alerts</h2>
                  {groupedAlerts.urgent.map(renderAlert)}
                </div>
              )}
              {groupedAlerts.high && groupedAlerts.high.length > 0 && (
                <div>
                  <h2 style={{ color: '#fd7e14' }}>High Priority</h2>
                  {groupedAlerts.high.map(renderAlert)}
                </div>
              )}
              {groupedAlerts.medium && groupedAlerts.medium.length > 0 && (
                <div>
                  <h2 style={{ color: '#ffc107' }}>Medium Priority</h2>
                  {groupedAlerts.medium.map(renderAlert)}
                </div>
              )}
              {groupedAlerts.low && groupedAlerts.low.length > 0 && (
                <div>
                  <h2 style={{ color: '#28a745' }}>Low Priority</h2>
                  {groupedAlerts.low.map(renderAlert)}
                </div>
              )}
            </div>
          ) : (
            // Show flat list for filtered views
            <div>
              <h2>
                {filter === 'unread' ? 'Unread Alerts' :
                 filter === 'urgent' ? 'Urgent Alerts' :
                 filter === 'high' ? 'High Priority Alerts' : 'All Alerts'}
              </h2>
              {alerts.map(renderAlert)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserAlerts;