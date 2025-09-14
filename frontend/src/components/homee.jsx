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
      <h1>Welcome!</h1>
      
      <div>
        <h2>Who is logged in:</h2>
        <p>Name: {user.name || user.username || 'User'}</p>
        <p>Email: {user.email}</p>
      </div>
      
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
};

export default UserHome;