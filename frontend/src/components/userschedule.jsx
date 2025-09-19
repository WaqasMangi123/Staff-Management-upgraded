import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const UserSchedule = () => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('upcoming'); // 'upcoming', 'today', 'all'
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();
  const API_BASE = 'https://staff-management-upgraded.onrender.com';

  useEffect(() => {
    loadMySchedule();
  }, [view]);

  const loadMySchedule = async () => {
    try {
      setError(null);
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('Please login to view your schedule');
        setLoading(false);
        return;
      }

      let endpoint;
      switch (view) {
        case 'today':
          endpoint = `${API_BASE}/api/tasks/today`;
          break;
        case 'upcoming':
          // Get all tasks and filter for upcoming dates on the frontend
          endpoint = `${API_BASE}/api/tasks/my-tasks?limit=100`;
          break;
        case 'all':
        default:
          endpoint = `${API_BASE}/api/tasks/my-tasks?limit=50`;
          break;
      }

      const response = await axios.get(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.data.success) {
        // Handle different response structures
        let tasks = [];
        if (view === 'today') {
          tasks = response.data.tasks || [];
        } else if (view === 'upcoming') {
          // Filter for upcoming tasks (future dates only)
          const allTasks = response.data.tasks || [];
          const today = new Date().toISOString().split('T')[0];
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + 30);
          const futureDateStr = futureDate.toISOString().split('T')[0];
          
          tasks = allTasks.filter(task => {
            return task.date > today && task.date <= futureDateStr && 
                   (task.status === 'pending' || task.status === 'in-progress');
          });
        } else {
          tasks = response.data.tasks || [];
        }
        
        setSchedules(tasks);
        
        // Calculate basic stats from the tasks
        if (view === 'all') {
          const basicStats = {
            total: tasks.length,
            completed: tasks.filter(t => t.status === 'completed').length,
            inProgress: tasks.filter(t => t.status === 'in-progress').length,
            pending: tasks.filter(t => t.status === 'pending').length,
            completionRate: 0
          };
          
          if (basicStats.total > 0) {
            basicStats.completionRate = Math.round((basicStats.completed / basicStats.total) * 100);
          }
          
          setStats(basicStats);
        }
        
        console.log('Loaded schedules:', tasks);
      } else {
        setError('Failed to load schedule data');
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load schedule';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateScheduleStatus = async (taskId, status) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(`${API_BASE}/api/tasks/update-status/${taskId}`, 
        { status }, 
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        loadMySchedule();
        alert(`Status updated to ${status} successfully`);
      } else {
        alert(`Failed to update status: ${response.data.message}`);
      }
    } catch (error) {
      console.error('Update status error:', error);
      alert(`Failed to update status: ${error.response?.data?.message || error.message}`);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return { backgroundColor: '#d4edda', color: '#155724' };
      case 'in-progress':
        return { backgroundColor: '#fff3cd', color: '#856404' };
      case 'cancelled':
        return { backgroundColor: '#f8d7da', color: '#721c24' };
      default:
        return { backgroundColor: '#e2e3e5', color: '#383d41' };
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return { backgroundColor: '#dc3545', color: 'white' };
      case 'high':
        return { backgroundColor: '#fd7e14', color: 'white' };
      case 'medium':
        return { backgroundColor: '#ffc107', color: 'black' };
      case 'low':
        return { backgroundColor: '#28a745', color: 'white' };
      default:
        return { backgroundColor: '#6c757d', color: 'white' };
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString();
    }
  };

  const groupTasksByDate = (tasks) => {
    const grouped = {};
    tasks.forEach(task => {
      const date = task.date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(task);
    });
    
    // Sort dates
    const sortedDates = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));
    const result = {};
    sortedDates.forEach(date => {
      result[date] = grouped[date];
    });
    
    return result;
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Loading your schedule...</h2>
        <p>Please wait while we fetch your tasks.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>My Schedule</h1>
        <button onClick={() => navigate('/user/home')} style={{ marginBottom: '20px' }}>
          Back to Home
        </button>
        <div style={{ backgroundColor: '#f8d7da', padding: '15px', borderRadius: '5px', border: '1px solid #f5c6cb' }}>
          <h3 style={{ color: '#721c24' }}>Error Loading Schedule</h3>
          <p>{error}</p>
          <button onClick={() => {
            setError(null);
            loadMySchedule();
          }} style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '3px' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const groupedTasks = view === 'upcoming' ? groupTasksByDate(schedules) : null;

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>My Schedule & Tasks</h1>
        <button onClick={() => navigate('/user/home')} style={{ backgroundColor: '#007bff', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px' }}>
          Back to Home
        </button>
      </div>

      {/* Stats Cards */}
      {stats && view === 'all' && (
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={{ backgroundColor: '#e3f2fd', padding: '15px', borderRadius: '8px', minWidth: '150px' }}>
            <h4 style={{ margin: '0 0 5px 0', color: '#1976d2' }}>Total Tasks</h4>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>{stats.total}</p>
          </div>
          <div style={{ backgroundColor: '#e8f5e8', padding: '15px', borderRadius: '8px', minWidth: '150px' }}>
            <h4 style={{ margin: '0 0 5px 0', color: '#388e3c' }}>Completed</h4>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>{stats.completed}</p>
          </div>
          <div style={{ backgroundColor: '#fff3e0', padding: '15px', borderRadius: '8px', minWidth: '150px' }}>
            <h4 style={{ margin: '0 0 5px 0', color: '#f57c00' }}>In Progress</h4>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>{stats.inProgress}</p>
          </div>
          <div style={{ backgroundColor: '#fce4ec', padding: '15px', borderRadius: '8px', minWidth: '150px' }}>
            <h4 style={{ margin: '0 0 5px 0', color: '#c2185b' }}>Completion Rate</h4>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>{stats.completionRate}%</p>
          </div>
        </div>
      )}

      {/* View Selection */}
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={() => setView('today')}
          style={{ 
            marginRight: '10px', 
            backgroundColor: view === 'today' ? '#007bff' : '#f8f9fa', 
            color: view === 'today' ? 'white' : '#495057',
            border: '1px solid #dee2e6',
            padding: '8px 16px',
            borderRadius: '5px'
          }}
        >
          Today's Tasks
        </button>
        <button 
          onClick={() => setView('upcoming')}
          style={{ 
            marginRight: '10px', 
            backgroundColor: view === 'upcoming' ? '#007bff' : '#f8f9fa', 
            color: view === 'upcoming' ? 'white' : '#495057',
            border: '1px solid #dee2e6',
            padding: '8px 16px',
            borderRadius: '5px'
          }}
        >
          Upcoming Tasks
        </button>
        <button 
          onClick={() => setView('all')}
          style={{ 
            backgroundColor: view === 'all' ? '#007bff' : '#f8f9fa', 
            color: view === 'all' ? 'white' : '#495057',
            border: '1px solid #dee2e6',
            padding: '8px 16px',
            borderRadius: '5px'
          }}
        >
          All Tasks
        </button>
      </div>

      {/* Tasks Display */}
      <div>
        <h2>
          {view === 'today' && 'Today\'s Tasks'}
          {view === 'upcoming' && 'Upcoming Tasks (Next 30 Days)'}
          {view === 'all' && 'All My Tasks'}
        </h2>
        
        {schedules.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <h3>No tasks found</h3>
            <p>
              {view === 'today' && 'You have no tasks scheduled for today.'}
              {view === 'upcoming' && 'You have no upcoming tasks in the next 30 days.'}
              {view === 'all' && 'You have no tasks assigned to you.'}
            </p>
          </div>
        ) : (
          <>
            {view === 'upcoming' && groupedTasks ? (
              // Grouped by date view for upcoming tasks
              <div>
                {Object.entries(groupedTasks).map(([date, tasks]) => (
                  <div key={date} style={{ marginBottom: '30px' }}>
                    <h3 style={{ backgroundColor: '#e9ecef', padding: '10px', borderRadius: '5px', margin: '0 0 15px 0' }}>
                      {formatDate(date)} ({tasks.length} task{tasks.length !== 1 ? 's' : ''})
                    </h3>
                    <div style={{ display: 'grid', gap: '15px', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))' }}>
                      {tasks.map(task => (
                        <TaskCard key={task._id} task={task} onStatusUpdate={updateScheduleStatus} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // List view for today and all tasks
              <div style={{ display: 'grid', gap: '15px', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))' }}>
                {schedules.map(task => (
                  <TaskCard key={task._id} task={task} onStatusUpdate={updateScheduleStatus} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Task Card Component
const TaskCard = ({ task, onStatusUpdate }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return { backgroundColor: '#d4edda', color: '#155724' };
      case 'in-progress':
        return { backgroundColor: '#fff3cd', color: '#856404' };
      case 'cancelled':
        return { backgroundColor: '#f8d7da', color: '#721c24' };
      default:
        return { backgroundColor: '#e2e3e5', color: '#383d41' };
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return { backgroundColor: '#dc3545', color: 'white' };
      case 'high':
        return { backgroundColor: '#fd7e14', color: 'white' };
      case 'medium':
        return { backgroundColor: '#ffc107', color: 'black' };
      case 'low':
        return { backgroundColor: '#28a745', color: 'white' };
      default:
        return { backgroundColor: '#6c757d', color: 'white' };
    }
  };

  return (
    <div style={{ 
      border: '1px solid #dee2e6', 
      borderRadius: '8px', 
      padding: '15px', 
      backgroundColor: 'white',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <h4 style={{ margin: '0 0 5px 0', color: '#495057' }}>{task.title}</h4>
        <div style={{ display: 'flex', gap: '5px' }}>
          <span style={{ 
            padding: '2px 8px', 
            borderRadius: '12px', 
            fontSize: '12px',
            ...getStatusColor(task.status)
          }}>
            {task.status}
          </span>
          <span style={{ 
            padding: '2px 8px', 
            borderRadius: '12px', 
            fontSize: '12px',
            ...getPriorityColor(task.priority)
          }}>
            {task.priority}
          </span>
        </div>
      </div>

      <div style={{ fontSize: '14px', color: '#6c757d', marginBottom: '10px' }}>
        <p style={{ margin: '2px 0' }}><strong>Category:</strong> {task.category}</p>
        <p style={{ margin: '2px 0' }}><strong>Location:</strong> {task.location}</p>
        <p style={{ margin: '2px 0' }}><strong>Date:</strong> {new Date(task.date).toLocaleDateString()}</p>
        {task.estimatedDuration && (
          <p style={{ margin: '2px 0' }}><strong>Duration:</strong> {task.estimatedDuration} minutes</p>
        )}
      </div>

      {task.description && (
        <div style={{ backgroundColor: '#f8f9fa', padding: '8px', borderRadius: '4px', marginBottom: '10px' }}>
          <small style={{ color: '#6c757d' }}>{task.description}</small>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {task.status === 'pending' && (
          <button 
            onClick={() => onStatusUpdate(task._id, 'in-progress')}
            style={{ 
              backgroundColor: '#17a2b8', 
              color: 'white', 
              border: 'none', 
              padding: '6px 12px', 
              borderRadius: '4px',
              fontSize: '12px'
            }}
          >
            Start Task
          </button>
        )}
        {task.status === 'in-progress' && (
          <button 
            onClick={() => onStatusUpdate(task._id, 'completed')}
            style={{ 
              backgroundColor: '#28a745', 
              color: 'white', 
              border: 'none', 
              padding: '6px 12px', 
              borderRadius: '4px',
              fontSize: '12px'
            }}
          >
            Complete Task
          </button>
        )}
        {(task.status === 'pending' || task.status === 'in-progress') && (
          <button 
            onClick={() => onStatusUpdate(task._id, 'cancelled')}
            style={{ 
              backgroundColor: '#dc3545', 
              color: 'white', 
              border: 'none', 
              padding: '6px 12px', 
              borderRadius: '4px',
              fontSize: '12px'
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

export default UserSchedule;