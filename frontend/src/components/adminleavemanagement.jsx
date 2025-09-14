import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminLeaveManagement = () => {
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approvalAction, setApprovalAction] = useState(null); // 'approve' or 'reject'
  const navigate = useNavigate();

  // Use full URL to backend - change this to your backend URL
  const API_BASE = 'http://localhost:5000';

  useEffect(() => {
    const adminToken = localStorage.getItem('adminToken');
    
    if (!adminToken) {
      alert('Admin access required');
      navigate('/admin/login');
      return;
    }

    fetchPendingLeaves();
  }, [navigate]);

  const fetchPendingLeaves = async () => {
    try {
      setLoading(true);
      setError(null);
      const adminToken = localStorage.getItem('adminToken');
      
      const response = await fetch(`${API_BASE}/api/auth/attendance/admin/pending-leaves`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Since populate might not work, we'll need to fetch user details separately
        const leavesWithUserDetails = await Promise.all(
          data.pendingLeaves.map(async (leave) => {
            try {
              // Fetch user details
              const userResponse = await fetch(`${API_BASE}/api/auth/users`, {
                headers: {
                  'Authorization': `Bearer ${adminToken}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (userResponse.ok) {
                const userData = await userResponse.json();
                const user = userData.users.find(u => u.id === leave.userId);
                return {
                  ...leave,
                  userDetails: user || { username: leave.username, email: leave.email }
                };
              }
              return {
                ...leave,
                userDetails: { username: leave.username, email: leave.email }
              };
            } catch (err) {
              console.error('Error fetching user details:', err);
              return {
                ...leave,
                userDetails: { username: leave.username, email: leave.email }
              };
            }
          })
        );
        
        setPendingLeaves(leavesWithUserDetails);
      } else {
        setError(data.message || 'Failed to fetch pending leaves');
      }
    } catch (error) {
      console.error('Error fetching pending leaves:', error);
      setError(`Failed to fetch pending leaves: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReject = async (leaveId, isApproved) => {
    try {
      setProcessingId(leaveId);
      setError(null);
      const adminToken = localStorage.getItem('adminToken');
      
      const response = await fetch(`${API_BASE}/api/auth/attendance/admin/approve-leave`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          attendanceId: leaveId,
          isApproved: isApproved,
          approvalNotes: approvalNotes.trim()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        alert(data.message);
        // Remove the processed leave from the list
        setPendingLeaves(prev => prev.filter(leave => leave._id !== leaveId));
        setShowApprovalModal(false);
        setSelectedLeave(null);
        setApprovalNotes('');
        setApprovalAction(null);
      } else {
        alert(data.message || 'Failed to process leave request');
      }
    } catch (error) {
      console.error('Error processing leave:', error);
      setError(`Failed to process leave request: ${error.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const openApprovalModal = (leave, action) => {
    setSelectedLeave(leave);
    setApprovalAction(action);
    setShowApprovalModal(true);
    setApprovalNotes('');
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
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Leave Management</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchPendingLeaves}
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
            onClick={() => navigate('/admin/dashboard')}
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
          {error}
        </div>
      )}

      {/* Summary */}
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        <h3 style={{ margin: 0 }}>Pending Leave Requests</h3>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffc107', marginTop: '10px' }}>
          {loading ? 'Loading...' : pendingLeaves.length}
        </div>
      </div>

      {/* Pending Leaves List */}
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
          Pending Leave Requests ({pendingLeaves.length})
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div>Loading pending leave requests...</div>
          </div>
        ) : pendingLeaves.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6c757d' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <div style={{ fontSize: '18px' }}>No pending leave requests</div>
            <div style={{ fontSize: '14px', marginTop: '8px' }}>All leave requests have been processed</div>
          </div>
        ) : (
          <div>
            {pendingLeaves.map((leave, index) => (
              <div
                key={leave._id}
                style={{
                  padding: '20px',
                  borderBottom: index < pendingLeaves.length - 1 ? '1px solid #e9ecef' : 'none',
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa'
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '15px' }}>
                  {/* Employee Info */}
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px' }}>
                      {leave.userDetails?.username || leave.username || 'Unknown User'}
                    </div>
                    <div style={{ color: '#6c757d', fontSize: '14px' }}>
                      {leave.userDetails?.email || leave.email || 'No email'}
                    </div>
                  </div>

                  {/* Leave Details */}
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                      Leave Date: {formatDate(leave.date)}
                    </div>
                    <div style={{ color: '#6c757d', fontSize: '14px', marginBottom: '4px' }}>
                      Type: {leave.leaveType ? leave.leaveType.charAt(0).toUpperCase() + leave.leaveType.slice(1) : 'Not specified'}
                    </div>
                    <div style={{ color: '#6c757d', fontSize: '14px' }}>
                      Applied: {formatTime(leave.createdAt)}
                    </div>
                  </div>

                  {/* Status */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      display: 'inline-block',
                      backgroundColor: '#ffc107',
                      color: 'black',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      PENDING APPROVAL
                    </div>
                  </div>
                </div>

                {/* Leave Reason */}
                <div style={{
                  backgroundColor: '#f8f9fa',
                  padding: '12px',
                  borderRadius: '6px',
                  marginBottom: '15px',
                  border: '1px solid #e9ecef'
                }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>Reason:</div>
                  <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
                    {leave.leaveReason || leave.notes || 'No reason provided'}
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => openApprovalModal(leave, 'approve')}
                    disabled={processingId === leave._id}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: processingId === leave._id ? '#6c757d' : '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: processingId === leave._id ? 'not-allowed' : 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    {processingId === leave._id ? 'Processing...' : '✅ Approve'}
                  </button>
                  <button
                    onClick={() => openApprovalModal(leave, 'reject')}
                    disabled={processingId === leave._id}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: processingId === leave._id ? '#6c757d' : '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: processingId === leave._id ? 'not-allowed' : 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    {processingId === leave._id ? 'Processing...' : '❌ Reject'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approval Modal */}
      {showApprovalModal && selectedLeave && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>
              {approvalAction === 'approve' ? 'Approve' : 'Reject'} Leave Request
            </h3>

            {/* Leave Details Summary */}
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '15px',
              borderRadius: '6px',
              marginBottom: '20px'
            }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>Employee:</strong> {selectedLeave.userDetails?.username || selectedLeave.username}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Date:</strong> {formatDate(selectedLeave.date)}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Type:</strong> {selectedLeave.leaveType || 'Not specified'}
              </div>
              <div>
                <strong>Reason:</strong> {selectedLeave.leaveReason || selectedLeave.notes || 'No reason provided'}
              </div>
            </div>

            {/* Approval Notes */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                {approvalAction === 'approve' ? 'Approval Notes (Optional):' : 'Rejection Reason:'}
              </label>
              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder={approvalAction === 'approve' 
                  ? 'Add any notes for the approval...' 
                  : 'Please provide a reason for rejection...'}
                style={{
                  width: '100%',
                  height: '80px',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  resize: 'vertical',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* Modal Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedLeave(null);
                  setApprovalNotes('');
                  setApprovalAction(null);
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
              <button
                onClick={() => handleApproveReject(selectedLeave._id, approvalAction === 'approve')}
                disabled={approvalAction === 'reject' && !approvalNotes.trim()}
                style={{
                  padding: '10px 20px',
                  backgroundColor: approvalAction === 'reject' && !approvalNotes.trim() 
                    ? '#6c757d' 
                    : approvalAction === 'approve' 
                      ? '#28a745' 
                      : '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: approvalAction === 'reject' && !approvalNotes.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {approvalAction === 'approve' ? '✅ Approve Leave' : '❌ Reject Leave'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debug Info */}
      <div style={{
        backgroundColor: '#e9ecef',
        padding: '10px',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#6c757d',
        marginTop: '20px'
      }}>
        <div>API Base: {API_BASE}</div>
        <div>Pending Leaves Count: {pendingLeaves.length}</div>
        <div>Loading: {loading ? 'Yes' : 'No'}</div>
      </div>
    </div>
  );
};

export default AdminLeaveManagement;