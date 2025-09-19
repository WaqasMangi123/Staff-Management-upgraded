import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminTaskManagement = () => {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('all');
  const [summary, setSummary] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignedTo: '',
    date: '',
    priority: 'medium',
    category: '',
    location: '',
    estimatedDuration: 60
  });
  const navigate = useNavigate();

  const API_BASE = 'https://staff-management-upgraded.onrender.com';
  const categories = ['Security', 'Maintenance', 'Cleaning', 'Administrative', 'Customer Service', 'Inspection', 'Training', 'Emergency Response'];
  const priorities = ['low', 'medium', 'high', 'urgent'];

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
      
      // First, let's debug the token
      console.log('Admin Token:', adminToken);
      
      // Try to decode the token to see what's inside
      try {
        const tokenPayload = JSON.parse(atob(adminToken.split('.')[1]));
        console.log('Token payload:', tokenPayload);
      } catch (e) {
        console.error('Error decoding token:', e);
      }

      // Load tasks with better error handling
      const tasksResponse = await fetch(`${API_BASE}/api/tasks/admin/all`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Tasks Response Status:', tasksResponse.status);
      console.log('Tasks Response Headers:', Object.fromEntries(tasksResponse.headers));

      if (tasksResponse.status === 403) {
        const errorData = await tasksResponse.json();
        console.error('403 Error details:', errorData);
        throw new Error(`Access forbidden - ${errorData.message}. Check admin token role.`);
      }

      if (!tasksResponse.ok) {
        const errorText = await tasksResponse.text();
        console.error('Tasks API error response:', errorText);
        throw new Error(`Tasks API failed: HTTP ${tasksResponse.status}: ${tasksResponse.statusText}`);
      }

      // Load users - no auth required according to your routes
      const usersResponse = await fetch(`${API_BASE}/api/auth/users`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
          // No auth header since your route doesn't require it
        }
      });

      console.log('Users Response Status:', usersResponse.status);

      if (!usersResponse.ok) {
        const errorText = await usersResponse.text();
        console.error('Users API error response:', errorText);
        throw new Error(`Users API failed: HTTP ${usersResponse.status}: ${usersResponse.statusText}`);
      }

      const tasksData = await tasksResponse.json();
      const usersData = await usersResponse.json();

      console.log('Tasks Data:', tasksData);
      console.log('Users Data:', usersData);

      if (tasksData.success) {
        setTasks(tasksData.tasks || []);
      } else {
        setError(tasksData.message || 'Failed to fetch tasks');
      }

      if (usersData.success) {
        console.log('Users data structure:', usersData.users);
        setUsers(usersData.users || []);
      } else {
        setError(usersData.message || 'Failed to fetch users');
      }

    } catch (error) {
      console.error('Error loading data:', error);
      setError(`Failed to load data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadTodaySummary = async () => {
    try {
      const adminToken = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE}/api/tasks/admin/today-summary`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 403) {
        const errorData = await response.json();
        console.error('403 Error details:', errorData);
        throw new Error(`Access forbidden - ${errorData.message}. Check admin token role.`);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setSummary(data);
      } else {
        setError(data.message || 'Failed to load summary');
      }
    } catch (error) {
      console.error('Error loading summary:', error);
      setError(`Failed to load summary: ${error.message}`);
    }
  };

  const createTask = async (e) => {
    e.preventDefault();
    try {
      const adminToken = localStorage.getItem('adminToken');
      console.log('Creating task with data:', formData);
      
      const response = await fetch(`${API_BASE}/api/tasks/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.status === 403) {
        const errorData = await response.json();
        console.error('403 Error details:', errorData);
        throw new Error(`Access forbidden - ${errorData.message}. Check admin token role.`);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log('Create task response:', data);
      
      if (data.success) {
        alert('Task created successfully');
        setFormData({
          title: '', description: '', assignedTo: '', date: '',
          priority: 'medium', category: '', location: '', estimatedDuration: 60
        });
        loadData();
      } else {
        alert(data.message || 'Failed to create task');
      }
    } catch (error) {
      console.error('Create task error:', error);
      setError(`Failed to create task: ${error.message}`);
    }
  };

  const deleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    
    try {
      const adminToken = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE}/api/tasks/delete/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 403) {
        const errorData = await response.json();
        console.error('403 Error details:', errorData);
        throw new Error(`Access forbidden - ${errorData.message}. Check admin token role.`);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        alert('Task deleted successfully');
        loadData();
      } else {
        alert(data.message || 'Failed to delete task');
      }
    } catch (error) {
      console.error('Delete task error:', error);
      setError(`Failed to delete task: ${error.message}`);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Task Management</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={loadData}
            style={{
              padding: '8px 16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Refresh
          </button>
          <button
            onClick={() => navigate('/admin-dashboard')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '20px',
          border: '1px solid #f5c6cb'
        }}>
          <strong>Error:</strong> {error}
          <br />
          <small>Check the browser console for more details.</small>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button 
          onClick={() => setView('all')}
          style={{
            padding: '10px 16px',
            backgroundColor: view === 'all' ? '#007bff' : '#f8f9fa',
            color: view === 'all' ? 'white' : '#495057',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          All Tasks ({tasks.length})
        </button>
        <button 
          onClick={() => setView('create')}
          style={{
            padding: '10px 16px',
            backgroundColor: view === 'create' ? '#007bff' : '#f8f9fa',
            color: view === 'create' ? 'white' : '#495057',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Create Task
        </button>
        <button 
          onClick={() => { setView('summary'); loadTodaySummary(); }}
          style={{
            padding: '10px 16px',
            backgroundColor: view === 'summary' ? '#007bff' : '#f8f9fa',
            color: view === 'summary' ? 'white' : '#495057',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Today's Summary
        </button>
      </div>

      {/* Debug Info */}
      <div style={{
        backgroundColor: '#e9ecef',
        padding: '10px',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#6c757d',
        marginBottom: '20px'
      }}>
        <div>API Base: {API_BASE}</div>
        <div>Users loaded: {users.length}</div>
        <div>Tasks loaded: {tasks.length}</div>
        <div>Loading: {loading ? 'Yes' : 'No'}</div>
        <div>Admin Token exists: {localStorage.getItem('adminToken') ? 'Yes' : 'No'}</div>
      </div>

      {/* All Tasks View */}
      {view === 'all' && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <div style={{
            backgroundColor: '#007bff',
            color: 'white',
            padding: '15px 20px',
            fontSize: '18px',
            fontWeight: 'bold'
          }}>
            All Tasks ({tasks.length})
          </div>
          
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div>Loading tasks...</div>
            </div>
          ) : tasks.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6c757d' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
              <div style={{ fontSize: '18px' }}>No tasks found</div>
              <div style={{ fontSize: '14px', marginTop: '8px' }}>Create your first task using the tabs above</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #dee2e6' }}>Title</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #dee2e6' }}>Assigned To</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #dee2e6' }}>Date</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #dee2e6' }}>Priority</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #dee2e6' }}>Category</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #dee2e6' }}>Status</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #dee2e6' }}>Rating</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #dee2e6' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task, index) => (
                    <tr key={task._id} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa' }}>
                      <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>{task.title}</td>
                      <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>{task.assignedTo?.username || 'Unknown User'}</td>
                      <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>{new Date(task.date).toLocaleDateString()}</td>
                      <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          backgroundColor: 
                            task.priority === 'urgent' ? '#dc3545' :
                            task.priority === 'high' ? '#fd7e14' :
                            task.priority === 'medium' ? '#ffc107' : '#28a745',
                          color: task.priority === 'medium' ? 'black' : 'white'
                        }}>
                          {task.priority}
                        </span>
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>{task.category}</td>
                      <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>{task.status}</td>
                      <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>{task.rating ? `${task.rating}/5` : 'Not rated'}</td>
                      <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                        <button 
                          onClick={() => deleteTask(task._id)}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Task View */}
      {view === 'create' && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          padding: '30px'
        }}>
          <h2 style={{ marginTop: 0, marginBottom: '30px' }}>Create New Task</h2>
          <form onSubmit={createTask}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Title:</label>
              <input 
                type="text" 
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Description:</label>
              <textarea 
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows="4"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Assign To:</label>
              <select 
                value={formData.assignedTo} 
                onChange={(e) => setFormData({...formData, assignedTo: e.target.value})}
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="">Select User ({users.length} available)</option>
                {users.map(user => (
                  <option key={user.id || user._id} value={user.id || user._id}>
                    {user.username || user.name} {user.email && `(${user.email})`}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Date:</label>
              <input 
                type="date" 
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Priority:</label>
              <select 
                value={formData.priority}
                onChange={(e) => setFormData({...formData, priority: e.target.value})}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                {priorities.map(priority => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Category:</label>
              <select 
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="">Select Category</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Location:</label>
              <input 
                type="text" 
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                required
                placeholder="Enter task location"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Duration (minutes):</label>
              <input 
                type="number" 
                value={formData.estimatedDuration}
                onChange={(e) => setFormData({...formData, estimatedDuration: parseInt(e.target.value)})}
                min="1"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <button 
              type="submit"
              style={{
                padding: '12px 24px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              Create Task
            </button>
          </form>
        </div>
      )}

      {/* Summary View */}
      {view === 'summary' && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          padding: '30px'
        }}>
          <h2 style={{ marginTop: 0, marginBottom: '30px' }}>Today's Task Summary</h2>
          
          {summary ? (
            <div>
              <h3>Summary for {summary.date}</h3>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '20px',
                marginBottom: '30px'
              }}>
                <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>{summary.summary.total}</div>
                  <div style={{ fontSize: '14px', color: '#6c757d' }}>Total</div>
                </div>
                <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>{summary.summary.completed}</div>
                  <div style={{ fontSize: '14px', color: '#6c757d' }}>Completed</div>
                </div>
                <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffc107' }}>{summary.summary.pending}</div>
                  <div style={{ fontSize: '14px', color: '#6c757d' }}>Pending</div>
                </div>
                <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#17a2b8' }}>{summary.summary.inProgress}</div>
                  <div style={{ fontSize: '14px', color: '#6c757d' }}>In Progress</div>
                </div>
                <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc3545' }}>{summary.summary.highPriority}</div>
                  <div style={{ fontSize: '14px', color: '#6c757d' }}>High Priority</div>
                </div>
              </div>

              {Object.keys(summary.tasksByCategory || {}).length > 0 && (
                <div>
                  <h3>Tasks by Category</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #dee2e6' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa' }}>
                        <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #dee2e6' }}>Category</th>
                        <th style={{ padding: '12px', textAlign: 'center', border: '1px solid #dee2e6' }}>Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(summary.tasksByCategory || {}).map(([category, count]) => (
                        <tr key={category}>
                          <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>{category}</td>
                          <td style={{ padding: '12px', textAlign: 'center', border: '1px solid #dee2e6' }}>{count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#6c757d' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
              <div style={{ fontSize: '18px' }}>No summary data available</div>
              <div style={{ fontSize: '14px', marginTop: '8px' }}>Summary will load automatically</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminTaskManagement;