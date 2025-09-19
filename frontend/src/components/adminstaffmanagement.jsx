import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import './AdminManageStaff.css';

const ManageStaff = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list', 'view', 'edit'
  const [editData, setEditData] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const navigate = useNavigate();

  const departments = [
    'Cleaning Staff',
    'Event Helpers',
    'Tea and Snack Staff', 
    'Maintenance Staff',
    'Outdoor Cleaners',
    'Office Helpers'
  ];

  useEffect(() => {
    checkAdminAuth();
    loadAllStaff();
  }, []);

  const checkAdminAuth = () => {
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
      toast.error('Admin access required');
      navigate('/admin/login');
    }
  };

  const loadAllStaff = async () => {
    try {
      const adminToken = localStorage.getItem('adminToken');
      const response = await axios.get('https://staff-management-upgraded.onrender.com/api/admin/all-staff', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      if (response.data.success) {
        setStaff(response.data.staff);
      }
    } catch (error) {
      console.error('Error loading staff:', error);
      toast.error('Failed to load staff data');
    } finally {
      setLoading(false);
    }
  };

  const handleView = (staffMember) => {
    setSelectedStaff(staffMember);
    setViewMode('view');
  };

  const handleEdit = (staffMember) => {
    setSelectedStaff(staffMember);
    setEditData({ ...staffMember });
    setViewMode('edit');
  };

  const handleDelete = async (staffId) => {
    if (!window.confirm('Are you sure you want to delete this staff member? This action cannot be undone.')) {
      return;
    }

    try {
      const adminToken = localStorage.getItem('adminToken');
      const response = await axios.delete(`https://staff-management-upgraded.onrender.com/api/admin/staff/${staffId}`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      if (response.data.success) {
        toast.success('Staff member deleted successfully');
        loadAllStaff(); // Reload the list
      }
    } catch (error) {
      console.error('Error deleting staff:', error);
      toast.error('Failed to delete staff member');
    }
  };

  const handleSaveEdit = async () => {
    try {
      const adminToken = localStorage.getItem('adminToken');
      const response = await axios.put(`https://staff-management-upgraded.onrender.com/api/admin/staff/${selectedStaff._id}`, editData, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      if (response.data.success) {
        toast.success('Staff information updated successfully');
        setViewMode('list');
        loadAllStaff();
      }
    } catch (error) {
      console.error('Error updating staff:', error);
      toast.error('Failed to update staff information');
    }
  };

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setEditData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: type === 'checkbox' ? checked : value
        }
      }));
    } else if (type === 'checkbox') {
      setEditData(prev => ({ ...prev, [name]: checked }));
    } else {
      setEditData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Filter staff based on search and department
  const filteredStaff = staff.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = !filterDepartment || member.department === filterDepartment;
    return matchesSearch && matchesDepartment;
  });

  if (loading) {
    return (
      <div className="manage-staff">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading staff data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="manage-staff">
      {viewMode === 'list' && (
        <>
          {/* Header */}
          <div className="staff-header">
            <h1>Manage Staff</h1>
            <button 
              onClick={() => navigate('/admin/dashboard')}
              className="back-btn"
            >
              Back to Dashboard
            </button>
          </div>

          {/* Search and Filter */}
          <div className="search-filter-section">
            <div>
              <label>Search Staff:</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, or job title..."
                className="search-input"
              />
            </div>

            <div>
              <label>Filter by Department:</label>
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="filter-select"
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Staff Count */}
          <div className="staff-count">
            <p><strong>Total Staff:</strong> {filteredStaff.length} {filteredStaff.length !== staff.length && `(filtered from ${staff.length})`}</p>
          </div>

          {/* Staff List */}
          <div className="table-container">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Job Title</th>
                  <th>Shift</th>
                  <th>Phone</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((member) => (
                  <tr key={member._id}>
                    <td className="staff-name">{member.name}</td>
                    <td>{member.email || 'N/A'}</td>
                    <td>{member.department}</td>
                    <td>{member.jobTitle}</td>
                    <td>{member.shift}</td>
                    <td>{member.phone}</td>
                    <td>
                      <button
                        onClick={() => handleView(member)}
                        className="action-btn btn-view"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleEdit(member)}
                        className="action-btn btn-edit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(member._id)}
                        className="action-btn btn-delete"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredStaff.length === 0 && (
              <div className="empty-state">
                <p>No staff members found.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* View Mode */}
      {viewMode === 'view' && selectedStaff && (
        <div className="detail-view">
          <div className="detail-header">
            <h2>Staff Details: {selectedStaff.name}</h2>
            <button 
              onClick={() => setViewMode('list')}
              className="back-btn"
            >
              Back to List
            </button>
          </div>

          <div className="detail-grid">
            <div className="detail-section personal-info">
              <h3>Personal Information</h3>
              <p><strong>Name:</strong> {selectedStaff.name}</p>
              <p><strong>Email:</strong> {selectedStaff.email || 'N/A'}</p>
              <p><strong>Phone:</strong> {selectedStaff.phone}</p>
              <p><strong>Years of Experience:</strong> {selectedStaff.yearsWorked}</p>
            </div>

            <div className="detail-section job-info">
              <h3>Job Information</h3>
              <p><strong>Department:</strong> {selectedStaff.department}</p>
              <p><strong>Job Title:</strong> {selectedStaff.jobTitle}</p>
              <p><strong>Shift:</strong> {selectedStaff.shift}</p>
              <p><strong>Working Hours:</strong> {selectedStaff.workingHours?.start} - {selectedStaff.workingHours?.end}</p>
              <p><strong>Shift Flexibility:</strong> {selectedStaff.shiftFlexibility ? 'Yes' : 'No'}</p>
            </div>
          </div>

          {selectedStaff.skills && selectedStaff.skills.length > 0 && (
            <div className="skills-container">
              <div className="detail-section skills-section">
                <h3>Skills</h3>
                <div className="skills-list">
                  {selectedStaff.skills.map((skill, index) => (
                    <span key={index} className="skill-tag">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {selectedStaff.emergencyContact && (
            <div className="detail-section emergency-contact">
              <h3>Emergency Contact</h3>
              <p><strong>Name:</strong> {selectedStaff.emergencyContact.name}</p>
              <p><strong>Relationship:</strong> {selectedStaff.emergencyContact.relationship}</p>
              <p><strong>Phone:</strong> {selectedStaff.emergencyContact.phone}</p>
            </div>
          )}

          {selectedStaff.notes && (
            <div className="detail-section notes-section">
              <h3>Additional Notes</h3>
              <p>{selectedStaff.notes}</p>
            </div>
          )}

          <div className="detail-actions">
            <button
              onClick={() => handleEdit(selectedStaff)}
              className="detail-btn btn-primary"
            >
              Edit Information
            </button>
            <button
              onClick={() => handleDelete(selectedStaff._id)}
              className="detail-btn btn-danger"
            >
              Delete Staff Member
            </button>
          </div>
        </div>
      )}

      {/* Edit Mode */}
      {viewMode === 'edit' && selectedStaff && (
        <div className="edit-form">
          <div className="detail-header">
            <h2>Edit Staff: {selectedStaff.name}</h2>
            <button 
              onClick={() => setViewMode('list')}
              className="back-btn"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(); }}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Name:</label>
                <input
                  type="text"
                  name="name"
                  value={editData.name || ''}
                  onChange={handleEditChange}
                  required
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone:</label>
                <input
                  type="tel"
                  name="phone"
                  value={editData.phone || ''}
                  onChange={handleEditChange}
                  required
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Department:</label>
                <select
                  name="department"
                  value={editData.department || ''}
                  onChange={handleEditChange}
                  required
                  className="form-select"
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Shift:</label>
                <select
                  name="shift"
                  value={editData.shift || ''}
                  onChange={handleEditChange}
                  required
                  className="form-select"
                >
                  <option value="">Select Shift</option>
                  <option value="Morning">Morning</option>
                  <option value="Evening">Evening</option>
                  <option value="Night">Night</option>
                  <option value="Flexible">Flexible</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Start Time:</label>
                <input
                  type="time"
                  name="workingHours.start"
                  value={editData.workingHours?.start || ''}
                  onChange={handleEditChange}
                  required
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">End Time:</label>
                <input
                  type="time"
                  name="workingHours.end"
                  value={editData.workingHours?.end || ''}
                  onChange={handleEditChange}
                  required
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="form-btn btn-success"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setViewMode('view')}
                className="form-btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ManageStaff;