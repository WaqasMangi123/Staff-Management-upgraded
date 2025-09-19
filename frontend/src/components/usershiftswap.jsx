import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const UserShiftSwap = () => {
  const [swapRequests, setSwapRequests] = useState({ sent: [], received: [] });
  const [mySchedules, setMySchedules] = useState([]);
  const [availablePartners, setAvailablePartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('requests'); // 'requests', 'create'
  const [selectedSchedule, setSelectedSchedule] = useState('');
  const navigate = useNavigate();
  const API_BASE = 'https://staff-management-upgraded.onrender.com';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Load swap requests
      const swapResponse = await axios.get(`${API_BASE}/api/shifts/my-requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (swapResponse.data.success) {
        setSwapRequests(swapResponse.data.requests);
      }

      // Load my schedules
      const scheduleResponse = await axios.get(`${API_BASE}/api/schedule/my-schedule`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (scheduleResponse.data.success) {
        setMySchedules(scheduleResponse.data.schedules.filter(s => s.status === 'scheduled'));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailablePartners = async (scheduleId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/api/shifts/available-partners/${scheduleId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.data.success) {
        setAvailablePartners(response.data.availablePartners);
      }
    } catch (error) {
      console.error('Error loading partners:', error);
    }
  };

  const requestSwap = async (targetScheduleId, reason) => {
    try {
      const token = localStorage.getItem('token');
      const targetSchedule = availablePartners.find(p => p._id === targetScheduleId);
      
      await axios.post(`${API_BASE}/api/shifts/request-swap`, {
        targetUserId: targetSchedule.userId._id,
        requesterScheduleId: selectedSchedule,
        targetScheduleId: targetScheduleId,
        reason: reason
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      alert('Swap request sent successfully');
      setView('requests');
      loadData();
    } catch (error) {
      alert('Failed to send swap request');
    }
  };

  const respondToSwap = async (swapId, action) => {
    try {
      const token = localStorage.getItem('token');
      const responseMessage = action === 'accepted' ? 
        prompt('Response message (optional):') : 
        prompt('Reason for rejection:');
      
      await axios.put(`${API_BASE}/api/shifts/respond/${swapId}`, {
        action: action,
        responseMessage: responseMessage || ''
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      alert(`Swap request ${action}`);
      loadData();
    } catch (error) {
      alert(`Failed to ${action} swap request`);
    }
  };

  const cancelSwap = async (swapId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE}/api/shifts/cancel/${swapId}`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      alert('Swap request cancelled');
      loadData();
    } catch (error) {
      alert('Failed to cancel swap request');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Shift Swap</h1>
      <button onClick={() => navigate('/user/home')}>Back to Home</button>
      
      <div>
        <button onClick={() => setView('requests')}>My Requests</button>
        <button onClick={() => setView('create')}>Request New Swap</button>
      </div>

      {view === 'requests' && (
        <div>
          <h2>Sent Requests</h2>
          {swapRequests.sent.length === 0 ? (
            <p>No sent requests</p>
          ) : (
            <table border="1">
              <thead>
                <tr>
                  <th>Target User</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {swapRequests.sent.map(request => (
                  <tr key={request._id}>
                    <td>{request.targetUserId.username}</td>
                    <td>{new Date(request.requesterScheduleId.date).toLocaleDateString()}</td>
                    <td>{request.status}</td>
                    <td>{request.reason}</td>
                    <td>
                      {request.status === 'pending' && (
                        <button onClick={() => cancelSwap(request._id)}>Cancel</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2>Received Requests</h2>
          {swapRequests.received.length === 0 ? (
            <p>No received requests</p>
          ) : (
            <table border="1">
              <thead>
                <tr>
                  <th>From User</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {swapRequests.received.map(request => (
                  <tr key={request._id}>
                    <td>{request.requesterId.username}</td>
                    <td>{new Date(request.targetScheduleId.date).toLocaleDateString()}</td>
                    <td>{request.status}</td>
                    <td>{request.reason}</td>
                    <td>
                      {request.status === 'pending' && (
                        <div>
                          <button onClick={() => respondToSwap(request._id, 'accepted')}>Accept</button>
                          <button onClick={() => respondToSwap(request._id, 'rejected')}>Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {view === 'create' && (
        <div>
          <h2>Request Shift Swap</h2>
          <div>
            <label>Select your shift to swap:</label>
            <select 
              value={selectedSchedule} 
              onChange={(e) => {
                setSelectedSchedule(e.target.value);
                if (e.target.value) {
                  loadAvailablePartners(e.target.value);
                }
              }}
            >
              <option value="">Choose a shift</option>
              {mySchedules.map(schedule => (
                <option key={schedule._id} value={schedule._id}>
                  {new Date(schedule.date).toLocaleDateString()} - {schedule.shift} ({schedule.startTime}-{schedule.endTime})
                </option>
              ))}
            </select>
          </div>

          {availablePartners.length > 0 && (
            <div>
              <h3>Available Partners</h3>
              <table border="1">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Date</th>
                    <th>Shift</th>
                    <th>Time</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {availablePartners.map(partner => (
                    <tr key={partner._id}>
                      <td>{partner.userId.username}</td>
                      <td>{new Date(partner.date).toLocaleDateString()}</td>
                      <td>{partner.shift}</td>
                      <td>{partner.startTime} - {partner.endTime}</td>
                      <td>
                        <button onClick={() => {
                          const reason = prompt('Reason for swap request:');
                          if (reason) requestSwap(partner._id, reason);
                        }}>
                          Request Swap
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
    </div>
  );
};

export default UserShiftSwap;