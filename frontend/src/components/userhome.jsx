import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const UserHome = () => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Get user data from localStorage
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (!token || !userData) {
      // If no data, go back to login
      navigate('/login');
      return;
    }

    // Set user data
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Welcome to Employee Portal!</h1>
      
      <div>
        <h2>Who is logged in:</h2>
        <p>Name: {user.name || user.username || 'User'}</p>
        <p>Email: {user.email}</p>
      </div>
      
      <div style={{ margin: '20px 0' }}>
        <h3>Profile & Settings</h3>
        <button 
          onClick={() => navigate('/user-profile')}
          style={{
            padding: '12px 24px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '10px',
            marginBottom: '10px',
            fontSize: '16px'
          }}
        >
          Complete Profile
        </button>
      </div>

      <div style={{ margin: '20px 0' }}>
        <h3>Daily Operations</h3>
        <button 
          onClick={() => navigate('/user/attendance')}
          style={{
            padding: '12px 24px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '10px',
            marginBottom: '10px',
            fontSize: '16px'
          }}
        >
          Attendance
        </button>

        <button 
          onClick={() => navigate('/user/schedule')}
          style={{
            padding: '12px 24px',
            backgroundColor: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '10px',
            marginBottom: '10px',
            fontSize: '16px'
          }}
        >
          My Schedule
        </button>

        <button 
          onClick={() => navigate('/user/tasks')}
          style={{
            padding: '12px 24px',
            backgroundColor: '#ffc107',
            color: 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '10px',
            marginBottom: '10px',
            fontSize: '16px'
          }}
        >
          My Tasks
        </button>
      </div>

      <div style={{ margin: '20px 0' }}>
        <h3>Shift Management</h3>
        <button 
          onClick={() => navigate('/user/shift-swap')}
          style={{
            padding: '12px 24px',
            backgroundColor: '#6f42c1',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '10px',
            marginBottom: '10px',
            fontSize: '16px'
          }}
        >
          Shift Swap
        </button>
      </div>

      <div style={{ margin: '20px 0' }}>
        <h3>Performance & Communication</h3>
        <button 
          onClick={() => navigate('/user/performance')}
          style={{
            padding: '12px 24px',
            backgroundColor: '#fd7e14',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '10px',
            marginBottom: '10px',
            fontSize: '16px'
          }}
        >
          My Performance
        </button>

        <button 
          onClick={() => navigate('/user/alerts')}
          style={{
            padding: '12px 24px',
            backgroundColor: '#e83e8c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '10px',
            marginBottom: '10px',
            fontSize: '16px'
          }}
        >
          My Alerts
        </button>
      </div>

      <div style={{ margin: '30px 0' }}>
        <button 
          onClick={handleLogout}
          style={{
            padding: '12px 24px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default UserHome;