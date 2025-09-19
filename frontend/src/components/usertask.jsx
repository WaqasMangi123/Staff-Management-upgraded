import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const UserTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [todayTasks, setTodayTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('today'); // 'today', 'all', 'stats'
  const [stats, setStats] = useState({});
  const navigate = useNavigate();
  const API_BASE = 'https://staff-management-upgraded.onrender.com';

  useEffect(() => {
    loadTasks();
  }, [view]);

  const loadTasks = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (view === 'today') {
        const response = await axios.get(`${API_BASE}/api/tasks/today`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.data.success) {
          setTodayTasks(response.data.tasks);
        }
      } else if (view === 'all') {
        const response = await axios.get(`${API_BASE}/api/tasks/my-tasks`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.data.success) {
          setTasks(response.data.tasks);
        }
      } else if (view === 'stats') {
        const response = await axios.get(`${API_BASE}/api/tasks/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.data.success) {
          setStats(response.data.stats);
        }
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId, status, notes = '') => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE}/api/tasks/update-status/${taskId}`, 
        { status, completionNotes: notes }, 
        { headers: { 'Authorization': `Bearer ${token}` }}
      );
      loadTasks();
      alert('Task status updated');
    } catch (error) {
      alert('Failed to update task status');
    }
  };

  if (loading) return <div>Loading tasks...</div>;

  return (
    <div>
      <h1>My Tasks</h1>
      <button onClick={() => navigate('/user/home')}>Back to Home</button>
      
      <div>
        <button onClick={() => setView('today')}>Today's Tasks</button>
        <button onClick={() => setView('all')}>All Tasks</button>
        <button onClick={() => setView('stats')}>My Statistics</button>
      </div>

      {view === 'today' && (
        <div>
          <h2>Today's Tasks</h2>
          {todayTasks.length === 0 ? (
            <p>No tasks for today</p>
          ) : (
            <table border="1">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {todayTasks.map(task => (
                  <tr key={task._id}>
                    <td>{task.title}</td>
                    <td>{task.priority}</td>
                    <td>{task.category}</td>
                    <td>{task.location}</td>
                    <td>{task.status}</td>
                    <td>
                      {task.status === 'pending' && (
                        <div>
                          <button onClick={() => updateTaskStatus(task._id, 'in-progress')}>
                            Start
                          </button>
                          <button onClick={() => updateTaskStatus(task._id, 'completed', prompt('Completion notes:'))}>
                            Complete
                          </button>
                        </div>
                      )}
                      {task.status === 'in-progress' && (
                        <button onClick={() => updateTaskStatus(task._id, 'completed', prompt('Completion notes:'))}>
                          Complete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {view === 'all' && (
        <div>
          <h2>All My Tasks</h2>
          {tasks.length === 0 ? (
            <p>No tasks assigned</p>
          ) : (
            <table border="1">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => (
                  <tr key={task._id}>
                    <td>{new Date(task.date).toLocaleDateString()}</td>
                    <td>{task.title}</td>
                    <td>{task.priority}</td>
                    <td>{task.category}</td>
                    <td>{task.status}</td>
                    <td>{task.rating ? `${task.rating}/5` : 'Not rated'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {view === 'stats' && (
        <div>
          <h2>My Task Statistics</h2>
          <p>Total Tasks: {stats.total}</p>
          <p>Completed: {stats.completed}</p>
          <p>Pending: {stats.pending}</p>
          <p>In Progress: {stats.inProgress}</p>
          <p>Completion Rate: {stats.completionRate}%</p>
          <p>Average Rating: {stats.averageRating}</p>
        </div>
      )}
    </div>
  );
};

export default UserTasks;