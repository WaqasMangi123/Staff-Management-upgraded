import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const UserAttendance = () => {
  const [user, setUser] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [attendanceStatus, setAttendanceStatus] = useState('not-checked-in');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAbsentForm, setShowAbsentForm] = useState(false);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [reason, setReason] = useState('');
  const [leaveType, setLeaveType] = useState('');
  const [showStatusChange, setShowStatusChange] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  // New history states
  const [showHistory, setShowHistory] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const navigate = useNavigate();

  // Use full URL to backend - change this to your backend URL
  const API_BASE = 'http://localhost:5000';

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (!token || !userData) {
      navigate('/login');
      return;
    }

    setUser(JSON.parse(userData));
    fetchTodayAttendance();
  }, [navigate]);

  const fetchTodayAttendance = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE}/api/auth/attendance/today`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setAttendance(data.attendance);
        setAttendanceStatus(data.status);
      } else {
        setError(data.message || 'Failed to fetch attendance');
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setError(`Connection failed: ${error.message}`);
    }
  };

  // New function to fetch attendance history
  const fetchAttendanceHistory = async (page = 1) => {
    try {
      setHistoryLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE}/api/auth/attendance/history?page=${page}&limit=10`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setAttendanceHistory(data.attendance);
        setCurrentPage(data.pagination.current);
        setTotalPages(data.pagination.total);
      } else {
        setError(data.message || 'Failed to fetch attendance history');
      }
    } catch (error) {
      console.error('Error fetching attendance history:', error);
      setError(`Failed to fetch history: ${error.message}`);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleShowHistory = () => {
    setShowHistory(true);
    fetchAttendanceHistory(1);
  };

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      setError(null);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE}/api/auth/attendance/check-in`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ location: 'Office' })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        alert(data.message);
        fetchTodayAttendance();
      } else {
        alert(data.message || 'Check-in failed');
      }
    } catch (error) {
      console.error('Check-in error:', error);
      setError(`Check-in failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setLoading(true);
    try {
      setError(null);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE}/api/auth/attendance/check-out`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ location: 'Office' })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        alert(data.message);
        fetchTodayAttendance();
      } else {
        alert(data.message || 'Check-out failed');
      }
    } catch (error) {
      console.error('Check-out error:', error);
      setError(`Check-out failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAbsent = async () => {
    if (!reason.trim()) {
      alert('Please provide a reason for absence');
      return;
    }

    setLoading(true);
    try {
      setError(null);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE}/api/auth/attendance/mark-absent`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          reason: reason.trim(),
          date: new Date().toISOString().split('T')[0]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        alert(data.message);
        setShowAbsentForm(false);
        setReason('');
        fetchTodayAttendance();
      } else {
        alert(data.message || 'Failed to mark absent');
      }
    } catch (error) {
      console.error('Mark absent error:', error);
      setError(`Mark absent failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyLeave = async () => {
    if (!reason.trim()) {
      alert('Please provide a reason for leave');
      return;
    }

    if (!leaveType) {
      alert('Please select a leave type');
      return;
    }

    setLoading(true);
    try {
      setError(null);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE}/api/auth/attendance/apply-leave`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          reason: reason.trim(),
          leaveType: leaveType,
          date: new Date().toISOString().split('T')[0]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        alert(data.message);
        setShowLeaveForm(false);
        setReason('');
        setLeaveType('');
        fetchTodayAttendance();
      } else {
        alert(data.message || 'Failed to apply leave');
      }
    } catch (error) {
      console.error('Apply leave error:', error);
      setError(`Apply leave failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!newStatus) {
      alert('Please select a status');
      return;
    }

    if (!statusReason.trim()) {
      alert('Please provide a reason for status change');
      return;
    }

    setLoading(true);
    try {
      setError(null);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE}/api/auth/attendance/change-status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          status: newStatus,
          reason: statusReason.trim(),
          date: new Date().toISOString().split('T')[0]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        alert(data.message);
        setShowStatusChange(false);
        setNewStatus('');
        setStatusReason('');
        fetchTodayAttendance();
      } else {
        alert(data.message || 'Failed to change status');
      }
    } catch (error) {
      console.error('Status change error:', error);
      setError(`Status change failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get approval status display
  const getApprovalStatusDisplay = (attendance) => {
    if (attendance.status !== 'leave') return '';
    
    if (attendance.isApproved === null) {
      return ' (Pending Approval)';
    } else if (attendance.isApproved === true) {
      return ' (Approved)';
    } else {
      return ' (Rejected)';
    }
  };

  const formatTime = (dateString) => {
    return dateString ? new Date(dateString).toLocaleTimeString() : 'Not recorded';
  };

  const formatWorkingHours = (minutes) => {
    if (!minutes) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (!user) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Attendance Management</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleShowHistory}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            View History
          </button>
          <button
            onClick={() => navigate('/user/home')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Back to Home
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
          {error}
        </div>
      )}

      {/* Current Time */}
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        <h3 style={{ margin: 0 }}>Current Time</h3>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff', marginTop: '10px' }}>
          {new Date().toLocaleString()}
        </div>
      </div>

      {/* Main Content - Show either today's attendance or history */}
      {!showHistory ? (
        <>
          {/* Today's Attendance */}
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            marginBottom: '20px'
          }}>
            <h2>Today's Attendance</h2>
            
            <div style={{ marginBottom: '20px' }}>
              <strong>Date:</strong> {new Date().toLocaleDateString()}
            </div>

            {attendance && (
              <div style={{ 
                backgroundColor: '#f8f9fa',
                padding: '15px',
                borderRadius: '6px',
                marginBottom: '20px'
              }}>
                <div style={{ marginBottom: '10px' }}>
                  <strong>Check-in:</strong> {formatTime(attendance.checkIn?.time)}
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <strong>Check-out:</strong> {formatTime(attendance.checkOut?.time)}
                </div>
                {attendance.workingHours > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Working Hours:</strong> {formatWorkingHours(attendance.workingHours)}
                  </div>
                )}
                <div>
                  <strong>Status:</strong> {attendance.status || 'present'}{getApprovalStatusDisplay(attendance)}
                  <button
                    onClick={() => setShowStatusChange(!showStatusChange)}
                    style={{
                      marginLeft: '10px',
                      padding: '4px 8px',
                      backgroundColor: '#17a2b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Change Status
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {attendanceStatus === 'not-checked-in' && (
                <>
                  <button
                    onClick={handleCheckIn}
                    disabled={loading}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: loading ? '#6c757d' : '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '16px'
                    }}
                  >
                    {loading ? 'Checking In...' : 'Check In'}
                  </button>

                  <button
                    onClick={() => setShowAbsentForm(!showAbsentForm)}
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
                    Mark Absent
                  </button>

                  <button
                    onClick={() => setShowLeaveForm(!showLeaveForm)}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#ffc107',
                      color: 'black',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '16px'
                    }}
                  >
                    Apply Leave
                  </button>
                </>
              )}

              {(attendanceStatus === 'checked-in' || attendanceStatus === 'checked-out') && (
                <>
                  {attendanceStatus === 'checked-in' && (
                    <button
                      onClick={handleCheckOut}
                      disabled={loading}
                      style={{
                        padding: '12px 24px',
                        backgroundColor: loading ? '#6c757d' : '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '16px'
                      }}
                    >
                      {loading ? 'Checking Out...' : 'Check Out'}
                    </button>
                  )}

                  {attendanceStatus === 'checked-out' && (
                    <div style={{
                      padding: '12px 24px',
                      backgroundColor: '#17a2b8',
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '16px'
                    }}>
                      Work Day Complete
                    </div>
                  )}

                  <button
                    onClick={() => setShowStatusChange(!showStatusChange)}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#6f42c1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '16px'
                    }}
                  >
                    Update Status
                  </button>
                </>
              )}

              {(attendanceStatus === 'absent' || attendanceStatus === 'leave') && (
                <div style={{
                  padding: '12px 24px',
                  backgroundColor: attendanceStatus === 'leave' && attendance?.isApproved === null ? 
                    '#ffc107' : '#6c757d',
                  color: attendanceStatus === 'leave' && attendance?.isApproved === null ? 
                    'black' : 'white',
                  borderRadius: '4px',
                  fontSize: '16px'
                }}>
                  {attendanceStatus === 'absent' ? 'Marked as Absent' : 
                   attendance?.isApproved === null ? 'Leave Pending Approval' :
                   attendance?.isApproved === true ? 'On Approved Leave' : 
                   'Leave Request Rejected'}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Attendance History View */
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>Attendance History</h2>
            <button
              onClick={() => setShowHistory(false)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Back to Today
            </button>
          </div>

          {historyLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div>Loading attendance history...</div>
            </div>
          ) : attendanceHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📅</div>
              <div style={{ fontSize: '18px' }}>No attendance records found</div>
            </div>
          ) : (
            <>
              {/* History Table */}
              <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse',
                  backgroundColor: 'white',
                  borderRadius: '8px'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Date</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Check-in</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Check-out</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Working Hours</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Status</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceHistory.map((record, index) => (
                      <tr key={record._id} style={{ 
                        borderBottom: '1px solid #dee2e6',
                        backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa'
                      }}>
                        <td style={{ padding: '12px' }}>
                          <strong>{new Date(record.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}</strong>
                        </td>
                        <td style={{ padding: '12px' }}>
                          {record.checkIn?.time ? new Date(record.checkIn.time).toLocaleTimeString() : '-'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          {record.checkOut?.time ? new Date(record.checkOut.time).toLocaleTimeString() : '-'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          {formatWorkingHours(record.workingHours)}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            backgroundColor: 
                              record.status === 'present' ? '#d4edda' :
                              record.status === 'late' ? '#fff3cd' :
                              record.status === 'absent' ? '#f8d7da' :
                              record.status === 'leave' ? 
                                (record.isApproved === null ? '#fff3cd' :
                                 record.isApproved === true ? '#d1ecf1' : '#f8d7da') :
                              '#e9ecef',
                            color:
                              record.status === 'present' ? '#155724' :
                              record.status === 'late' ? '#856404' :
                              record.status === 'absent' ? '#721c24' :
                              record.status === 'leave' ?
                                (record.isApproved === null ? '#856404' :
                                 record.isApproved === true ? '#0c5460' : '#721c24') :
                              '#495057'
                          }}>
                            {record.status === 'leave' && record.isApproved === null ? 'Leave (Pending)' :
                             record.status === 'leave' && record.isApproved === true ? 'Leave (Approved)' :
                             record.status === 'leave' && record.isApproved === false ? 'Leave (Rejected)' :
                             record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontSize: '12px', color: '#6c757d', maxWidth: '200px' }}>
                          {record.leaveReason || record.absentReason || record.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  gap: '10px',
                  marginTop: '20px'
                }}>
                  <button
                    onClick={() => fetchAttendanceHistory(currentPage - 1)}
                    disabled={currentPage === 1}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: currentPage === 1 ? '#6c757d' : '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Previous
                  </button>
                  
                  <span style={{ padding: '0 15px', fontSize: '14px' }}>
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <button
                    onClick={() => fetchAttendanceHistory(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: currentPage === totalPages ? '#6c757d' : '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Forms remain the same - only showing when in today's view */}
      {!showHistory && (
        <>
          {/* Absent Form */}
          {showAbsentForm && (
            <div style={{
              backgroundColor: '#fff3cd',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #ffeaa7'
            }}>
              <h3 style={{ color: '#856404', marginTop: 0 }}>Mark as Absent</h3>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please provide reason for absence..."
                style={{
                  width: '100%',
                  height: '80px',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  resize: 'vertical',
                  marginBottom: '15px'
                }}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleMarkAbsent}
                  disabled={loading || !reason.trim()}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: loading || !reason.trim() ? '#6c757d' : '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading || !reason.trim() ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'Submitting...' : 'Submit Absent'}
                </button>
                <button
                  onClick={() => {
                    setShowAbsentForm(false);
                    setReason('');
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Leave Form */}
          {showLeaveForm && (
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #dee2e6'
            }}>
              <h3 style={{ color: '#495057', marginTop: 0 }}>Apply for Leave</h3>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Leave Type:
                </label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    marginBottom: '10px'
                  }}
                >
                  <option value="">-- Select Leave Type --</option>
                  <option value="sick">Sick Leave</option>
                  <option value="personal">Personal Leave</option>
                  <option value="emergency">Emergency Leave</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Reason for Leave:
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please provide detailed reason for leave..."
                  style={{
                    width: '100%',
                    height: '80px',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{
                backgroundColor: '#d4edda',
                border: '1px solid #c3e6cb',
                color: '#155724',
                padding: '10px',
                borderRadius: '4px',
                marginBottom: '15px',
                fontSize: '14px'
              }}>
                <strong>Note:</strong> Your leave request will be sent to admin for approval. 
                You will be notified once it's reviewed.
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleApplyLeave}
                  disabled={loading || !reason.trim() || !leaveType}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: loading || !reason.trim() || !leaveType ? '#6c757d' : '#ffc107',
                    color: loading || !reason.trim() || !leaveType ? 'white' : 'black',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading || !reason.trim() || !leaveType ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'Submitting...' : 'Submit Leave Request'}
                </button>
                <button
                  onClick={() => {
                    setShowLeaveForm(false);
                    setReason('');
                    setLeaveType('');
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Status Change Form */}
          {showStatusChange && (
            <div style={{
              backgroundColor: '#e9ecef',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #dee2e6'
            }}>
              <h3 style={{ color: '#495057', marginTop: 0 }}>Change Status</h3>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Select New Status:
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">-- Select Status --</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="leave">On Leave</option>
                  <option value="half-day">Half Day</option>
                  <option value="late">Late</option>
                </select>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Reason for Status Change:
                </label>
                <textarea
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="Please provide reason for status change..."
                  style={{
                    width: '100%',
                    height: '80px',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleStatusChange}
                  disabled={loading || !newStatus || !statusReason.trim()}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: loading || !newStatus || !statusReason.trim() ? '#6c757d' : '#6f42c1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading || !newStatus || !statusReason.trim() ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'Updating...' : 'Update Status'}
                </button>
                <button
                  onClick={() => {
                    setShowStatusChange(false);
                    setNewStatus('');
                    setStatusReason('');
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Debug Info */}
      <div style={{
        backgroundColor: '#e9ecef',
        padding: '10px',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#6c757d'
      }}>
        <div>API Base: {API_BASE}</div>
        <div>Status: {attendanceStatus}</div>
        <div>User ID: {user?.id}</div>
        <div>Current View: {showHistory ? 'History' : 'Today'}</div>
      </div>
    </div>
  );
};

export default UserAttendance;