import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AdminScheduleManagement = () => {
  const [schedules, setSchedules] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [validCategories, setValidCategories] = useState([]);
  const [view, setView] = useState('all'); // 'all', 'create', 'bulk'
  const [formData, setFormData] = useState({
    userId: '',
    date: '',
    shift: 'Morning',
    startTime: '09:00',
    endTime: '17:00',
    location: '',
    department: '',
    notes: ''
  });
  const navigate = useNavigate();
  const API_BASE = 'http://localhost:5000';

  const departments = ['Cleaning Staff', 'Event Helpers', 'Tea and Snack Staff', 'Maintenance Staff', 'Outdoor Cleaners', 'Office Helpers'];
  
  // Map departments to valid task categories
  const getDepartmentCategory = (department, validCategories) => {
    const mapping = {
      'Cleaning Staff': 'Cleaning',
      'Event Helpers': 'Customer Service', 
      'Tea and Snack Staff': 'Customer Service',
      'Maintenance Staff': 'Maintenance',
      'Outdoor Cleaners': 'Cleaning',
      'Office Helpers': 'Administrative'
    };
    
    const mappedCategory = mapping[department];
    // If the mapped category exists in valid categories, use it, otherwise default to first valid category
    if (validCategories.includes(mappedCategory)) {
      return mappedCategory;
    }
    return validCategories[0] || 'Administrative';
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setError(null);
      const adminToken = localStorage.getItem('adminToken');
      
      if (!adminToken) {
        setError('Admin token not found. Please login again.');
        setLoading(false);
        return;
      }
      
      const [schedulesRes, usersRes, categoriesRes] = await Promise.all([
        axios.get(`${API_BASE}/api/tasks/admin/all`, {
          headers: { 'Authorization': `Bearer ${adminToken}` }
        }),
        axios.get(`${API_BASE}/api/admin/all-staff`, {
          headers: { 'Authorization': `Bearer ${adminToken}` }
        }),
        axios.get(`${API_BASE}/api/tasks/categories`, {
          headers: { 'Authorization': `Bearer ${adminToken}` }
        }).catch(err => {
          console.warn('Failed to fetch categories:', err);
          return { data: { success: true, categories: ['Security', 'Maintenance', 'Cleaning', 'Administrative', 'Customer Service', 'Inspection', 'Training', 'Emergency Response'] } };
        })
      ]);

      // Safely handle the responses
      if (schedulesRes.data && schedulesRes.data.success) {
        setSchedules(Array.isArray(schedulesRes.data.tasks) ? schedulesRes.data.tasks : []);
      } else {
        console.warn('Schedules API response:', schedulesRes.data);
        setSchedules([]);
      }
      
      if (usersRes.data && usersRes.data.success) {
        setUsers(Array.isArray(usersRes.data.staff) ? usersRes.data.staff : []);
      } else {
        console.warn('Users API response:', usersRes.data);
        setUsers([]);
      }
      
      // Handle categories
      if (categoriesRes.data && categoriesRes.data.success) {
        setValidCategories(Array.isArray(categoriesRes.data.categories) ? categoriesRes.data.categories : []);
      } else {
        console.warn('Categories API response:', categoriesRes.data);
        setValidCategories(['Security', 'Maintenance', 'Cleaning', 'Administrative', 'Customer Service', 'Inspection', 'Training', 'Emergency Response']);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setError(`Failed to load data: ${error.response?.data?.message || error.message}`);
      // Ensure states remain as arrays even on error
      setSchedules([]);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    try {
      // Try both token types - adminToken for admin routes, regular token for task routes
      const adminToken = localStorage.getItem('adminToken');
      const userToken = localStorage.getItem('token');
      
      // Use adminToken if available, otherwise userToken
      const authToken = adminToken || userToken;
      
      if (!authToken) {
        alert('Authentication token not found. Please login again.');
        return;
      }
      
      // Transform form data to match task API requirements
      const validCategory = getDepartmentCategory(formData.department, validCategories);
      
      const taskData = {
        title: `${formData.shift} Shift - ${formData.department}`,
        assignedTo: formData.userId,
        date: formData.date,
        category: validCategory,
        location: formData.location,
        description: `Shift: ${formData.shift} (${formData.startTime} - ${formData.endTime})\nDepartment: ${formData.department}\nNotes: ${formData.notes}`,
        priority: 'medium',
        estimatedDuration: calculateDuration(formData.startTime, formData.endTime)
      };
      
      console.log('Sending task data:', taskData);
      console.log('Valid categories:', validCategories);
      console.log('Selected category:', validCategory);
      
      // Use the task creation endpoint since there's no dedicated schedule endpoint
      const response = await axios.post(`${API_BASE}/api/tasks/create`, taskData, {
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success) {
        alert('Schedule created successfully');
        setFormData({
          userId: '', date: '', shift: 'Morning', startTime: '09:00',
          endTime: '17:00', location: '', department: '', notes: ''
        });
        await loadData();
      } else {
        alert(`Failed to create schedule: ${response.data.message}`);
      }
    } catch (error) {
      console.error('Create schedule error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Full error response:', error.response);
      
      let errorMessage = 'Unknown error occurred';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
        if (error.response.data.error && error.response.data.error !== error.response.data.message) {
          errorMessage += `\n\nDetails: ${error.response.data.error}`;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(`Failed to create schedule: ${errorMessage}`);
    }
  };

  // Helper function to calculate duration in minutes
  const calculateDuration = (startTime, endTime) => {
    const start = new Date(`1970-01-01T${startTime}:00`);
    const end = new Date(`1970-01-01T${endTime}:00`);
    return Math.abs(end - start) / (1000 * 60); // duration in minutes
  };

  const updateScheduleStatus = async (scheduleId, status) => {
    try {
      const adminToken = localStorage.getItem('adminToken');
      
      if (!adminToken) {
        alert('Admin token not found. Please login again.');
        return;
      }
      
      const response = await axios.put(`${API_BASE}/api/tasks/update-status/${scheduleId}`, 
        { status }, 
        { headers: { 'Authorization': `Bearer ${adminToken}` }}
      );
      
      if (response.data.success) {
        alert('Schedule status updated');
        await loadData();
      } else {
        alert(`Failed to update status: ${response.data.message}`);
      }
    } catch (error) {
      console.error('Update status error:', error);
      alert(`Failed to update status: ${error.response?.data?.message || error.message}`);
    }
  };

  const deleteSchedule = async (scheduleId) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;
    
    try {
      const adminToken = localStorage.getItem('adminToken');
      
      if (!adminToken) {
        alert('Admin token not found. Please login again.');
        return;
      }
      
      const response = await axios.delete(`${API_BASE}/api/tasks/delete/${scheduleId}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      
      if (response.data.success) {
        alert('Schedule deleted successfully');
        await loadData();
      } else {
        alert(`Failed to delete schedule: ${response.data.message}`);
      }
    } catch (error) {
      console.error('Delete schedule error:', error);
      alert(`Failed to delete schedule: ${error.response?.data?.message || error.message}`);
    }
  };

  const bulkCreateSchedules = async () => {
    const scheduleData = prompt('Enter JSON array of schedules:');
    if (!scheduleData) return;
    
    try {
      const adminToken = localStorage.getItem('adminToken');
      
      if (!adminToken) {
        alert('Admin token not found. Please login again.');
        return;
      }
      
      const schedules = JSON.parse(scheduleData);
      
      if (!Array.isArray(schedules)) {
        alert('Please enter a valid JSON array');
        return;
      }
      
      const response = await axios.post(`${API_BASE}/api/tasks/bulk-create`, { tasks: schedules }, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      
      if (response.data.success) {
        alert(`Bulk schedules created successfully: ${response.data.message}`);
        await loadData();
      } else {
        alert(`Failed to create bulk schedules: ${response.data.message}`);
      }
    } catch (error) {
      if (error.name === 'SyntaxError') {
        alert('Invalid JSON format. Please check your input.');
      } else {
        console.error('Bulk create error:', error);
        alert(`Failed to create bulk schedules: ${error.response?.data?.message || error.message}`);
      }
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Loading schedule data...</h2>
        <p>Please wait while we fetch the information.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Schedule Management</h1>
        <button onClick={() => navigate('/admin-dashboard')}>Back to Dashboard</button>
        <div style={{ backgroundColor: '#fee', padding: '15px', margin: '20px 0', border: '1px solid #fcc' }}>
          <h3 style={{ color: '#c00' }}>Error Loading Data</h3>
          <p>{error}</p>
          <button onClick={() => {
            setError(null);
            setLoading(true);
            loadData();
          }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Schedule Management</h1>
      <button onClick={() => navigate('/admin-dashboard')}>Back to Dashboard</button>
      
      <div style={{ margin: '20px 0' }}>
        <button 
          onClick={() => setView('all')}
          style={{ marginRight: '10px', backgroundColor: view === 'all' ? '#007bff' : '', color: view === 'all' ? 'white' : '' }}
        >
          All Schedules
        </button>
        <button 
          onClick={() => setView('create')}
          style={{ marginRight: '10px', backgroundColor: view === 'create' ? '#007bff' : '', color: view === 'create' ? 'white' : '' }}
        >
          Create Schedule
        </button>
        <button 
          onClick={() => setView('bulk')}
          style={{ backgroundColor: view === 'bulk' ? '#007bff' : '', color: view === 'bulk' ? 'white' : '' }}
        >
          Bulk Operations
        </button>
      </div>

      {view === 'all' && (
        <div>
          <h2>All Schedules</h2>
          <p>Total Schedules: {schedules?.length || 0}</p>
          <p>Total Users: {users?.length || 0}</p>
          
          {schedules && schedules.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table border="1" width="100%" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={{ padding: '8px' }}>Assigned To</th>
                    <th style={{ padding: '8px' }}>Date</th>
                    <th style={{ padding: '8px' }}>Priority</th>
                    <th style={{ padding: '8px' }}>Duration</th>
                    <th style={{ padding: '8px' }}>Location</th>
                    <th style={{ padding: '8px' }}>Category</th>
                    <th style={{ padding: '8px' }}>Status</th>
                    <th style={{ padding: '8px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((schedule, index) => (
                    <tr key={schedule._id || `schedule-${index}`}>
                      <td style={{ padding: '8px' }}>{schedule.assignedTo?.username || schedule.username || 'Unknown'}</td>
                      <td style={{ padding: '8px' }}>{schedule.date ? new Date(schedule.date).toLocaleDateString() : 'N/A'}</td>
                      <td style={{ padding: '8px' }}>{schedule.priority || 'Medium'}</td>
                      <td style={{ padding: '8px' }}>{schedule.estimatedDuration ? `${schedule.estimatedDuration} min` : 'N/A'}</td>
                      <td style={{ padding: '8px' }}>{schedule.location || 'N/A'}</td>
                      <td style={{ padding: '8px' }}>{schedule.category || 'N/A'}</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{ 
                          padding: '2px 6px', 
                          borderRadius: '3px', 
                          backgroundColor: schedule.status === 'completed' ? '#d4edda' : schedule.status === 'in-progress' ? '#fff3cd' : '#f8d7da',
                          color: schedule.status === 'completed' ? '#155724' : schedule.status === 'in-progress' ? '#856404' : '#721c24'
                        }}>
                          {schedule.status || 'pending'}
                        </span>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <select 
                          onChange={(e) => {
                            if (e.target.value) {
                              updateScheduleStatus(schedule._id, e.target.value);
                              e.target.value = ''; // Reset select
                            }
                          }} 
                          defaultValue=""
                          style={{ marginBottom: '5px' }}
                        >
                          <option value="">Change Status</option>
                          <option value="pending">Pending</option>
                          <option value="in-progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <br />
                        <button 
                          onClick={() => deleteSchedule(schedule._id)}
                          style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '3px' }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}>
              <h3>No schedules found</h3>
              <p>Get started by creating your first schedule.</p>
              <button onClick={() => setView('create')} style={{ backgroundColor: '#007bff', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px' }}>
                Create Schedule
              </button>
            </div>
          )}
        </div>
      )}

      {view === 'create' && (
        <div>
          <h2>Create New Schedule</h2>
          <form onSubmit={handleCreateSchedule} style={{ maxWidth: '600px' }}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>User:</label>
              <select 
                value={formData.userId} 
                onChange={(e) => setFormData({...formData, userId: e.target.value})}
                required
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="">Select User</option>
                {users && users.map((user) => (
                  <option key={user.userId || user._id} value={user.userId || user._id}>
                    {user.name || user.username} ({user.department || 'No Department'})
                  </option>
                ))}
              </select>
              {users && users.length === 0 && (
                <small style={{ color: '#6c757d' }}>No users available. Please check user management.</small>
              )}
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Date:</label>
              <input 
                type="date" 
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                required
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Shift:</label>
              <select 
                value={formData.shift}
                onChange={(e) => setFormData({...formData, shift: e.target.value})}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="Morning">Morning</option>
                <option value="Evening">Evening</option>
                <option value="Night">Night</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Start Time:</label>
                <input 
                  type="time" 
                  value={formData.startTime}
                  onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                  required
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>End Time:</label>
                <input 
                  type="time" 
                  value={formData.endTime}
                  onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                  required
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Location:</label>
              <input 
                type="text" 
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                placeholder="Enter location"
                required
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Department:</label>
              <select 
                value={formData.department}
                onChange={(e) => setFormData({...formData, department: e.target.value})}
                required
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="">Select Department</option>
                {departments.map(dept => {
                  const mappedCategory = getDepartmentCategory(dept, validCategories);
                  return (
                    <option key={dept} value={dept}>
                      {dept} → {mappedCategory}
                    </option>
                  );
                })}
              </select>
              {validCategories.length > 0 && (
                <small style={{ color: '#6c757d', display: 'block', marginTop: '4px' }}>
                  Valid task categories: {validCategories.join(', ')}
                </small>
              )}
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Notes:</label>
              <textarea 
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Additional notes"
                rows="3"
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical' }}
              />
            </div>

            <button 
              type="submit" 
              style={{ backgroundColor: '#28a745', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '5px', cursor: 'pointer' }}
            >
              Create Schedule
            </button>
          </form>
        </div>
      )}

      {view === 'bulk' && (
        <div>
          <h2>Bulk Operations</h2>
          <button 
            onClick={bulkCreateSchedules}
            style={{ backgroundColor: '#17a2b8', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '5px', marginBottom: '20px' }}
          >
            Bulk Create Schedules
          </button>
          <p><strong>Note:</strong> Use JSON format for bulk creation</p>
          <div style={{ backgroundColor: '#f8f9fa', padding: '15px', border: '1px solid #dee2e6', borderRadius: '5px' }}>
            <h3>Sample Format:</h3>
            <pre style={{ backgroundColor: '#e9ecef', padding: '10px', borderRadius: '3px', overflow: 'auto' }}>
{`[
  {
    "title": "Morning Shift - Cleaning Staff",
    "assignedTo": "user_id_here",
    "date": "2024-01-15",
    "category": "Cleaning Staff",
    "location": "Office Building A",
    "description": "Shift: Morning (09:00 - 17:00)\\nNotes: Regular cleaning schedule",
    "priority": "medium",
    "estimatedDuration": 480
  }
]`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminScheduleManagement;