import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AdminShiftSwapManagement = () => {
  const [swapRequests, setSwapRequests] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('pending'); // 'pending', 'all'
  const navigate = useNavigate();
  const API_BASE = 'https://staff-management-upgraded.onrender.com';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const adminToken = localStorage.getItem('adminToken');
      
      const [pendingRes, allRes] = await Promise.all([
        axios.get(`${API_BASE}/api/shifts/admin/pending`, {
          headers: { 'Authorization': `Bearer ${adminToken}` }
        }),
        axios.get(`${API_BASE}/api/shifts/admin/all`, {
          headers: { 'Authorization': `Bearer ${adminToken}` }
        })
      ]);

      if (pendingRes.data.success) setPendingApprovals(pendingRes.data.pendingApprovals);
      if (allRes.data.success) setSwapRequests(allRes.data.swapRequests);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const approveSwap = async (swapId, action, notes = '') => {
    try {
      const adminToken = localStorage.getItem('adminToken');
      await axios.put(`${API_BASE}/api/shifts/admin/approve/${swapId}`, {
        action: action,
        approvalNotes: notes
      }, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      alert(`Swap request ${action} successfully`);
      loadData();
    } catch (error) {
      alert(`Failed to ${action} swap request`);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Shift Swap Management</h1>
      <button onClick={() => navigate('/admin/dashboard')}>Back to Dashboard</button>
      
      <div>
        <button onClick={() => setView('pending')}>Pending Approvals ({pendingApprovals.length})</button>
        <button onClick={() => setView('all')}>All Swap Requests</button>
      </div>

      {view === 'pending' && (
        <div>
          <h2>Pending Admin Approvals</h2>
          {pendingApprovals.length === 0 ? (
            <p>No pending approvals</p>
          ) : (
            <table border="1">
              <thead>
                <tr>
                  <th>Requester</th>
                  <th>Target User</th>
                  <th>Requester Shift</th>
                  <th>Target Shift</th>
                  <th>Reason</th>
                  <th>Requested On</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingApprovals.map(request => (
                  <tr key={request._id}>
                    <td>{request.requesterId.username}</td>
                    <td>{request.targetUserId.username}</td>
                    <td>
                      {new Date(request.requesterScheduleId.date).toLocaleDateString()}
                      <br />
                      {request.requesterScheduleId.shift} ({request.requesterScheduleId.startTime}-{request.requesterScheduleId.endTime})
                    </td>
                    <td>
                      {new Date(request.targetScheduleId.date).toLocaleDateString()}
                      <br />
                      {request.targetScheduleId.shift} ({request.targetScheduleId.startTime}-{request.targetScheduleId.endTime})
                    </td>
                    <td>{request.reason}</td>
                    <td>{new Date(request.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button onClick={() => {
                        const notes = prompt('Approval notes (optional):');
                        approveSwap(request._id, 'approved', notes);
                      }}>
                        Approve
                      </button>
                      <button onClick={() => {
                        const notes = prompt('Rejection reason:');
                        if (notes) approveSwap(request._id, 'rejected', notes);
                      }}>
                        Reject
                      </button>
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
          <h2>All Swap Requests</h2>
          <table border="1">
            <thead>
              <tr>
                <th>Requester</th>
                <th>Target User</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Requested On</th>
                <th>Admin Approval</th>
              </tr>
            </thead>
            <tbody>
              {swapRequests.map(request => (
                <tr key={request._id}>
                  <td>{request.requesterId.username}</td>
                  <td>{request.targetUserId.username}</td>
                  <td>{request.status}</td>
                  <td>{request.reason}</td>
                  <td>{new Date(request.createdAt).toLocaleDateString()}</td>
                  <td>
                    {request.adminApproval?.status || 'Not Required'}
                    {request.adminApproval?.approvalNotes && (
                      <div><small>{request.adminApproval.approvalNotes}</small></div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminShiftSwapManagement;