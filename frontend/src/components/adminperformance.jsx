import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AdminPerformanceManagement = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [userPerformance, setUserPerformance] = useState(null);
  const [companyOverview, setCompanyOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('overview'); // 'overview', 'user', 'department'
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const navigate = useNavigate();
  const API_BASE = 'https://staff-management-upgraded.onrender.com';

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear]);

  const loadData = async () => {
    try {
      const adminToken = localStorage.getItem('adminToken');
      
      const [usersRes, overviewRes] = await Promise.all([
        axios.get(`${API_BASE}/api/admin/all-staff`, {
          headers: { 'Authorization': `Bearer ${adminToken}` }
        }),
        axios.get(`${API_BASE}/api/performance/company-overview`, {
          params: { month: selectedMonth.toString().padStart(2, '0'), year: selectedYear },
          headers: { 'Authorization': `Bearer ${adminToken}` }
        })
      ]);

      if (usersRes.data.success) setUsers(usersRes.data.staff);
      if (overviewRes.data.success) setCompanyOverview(overviewRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserPerformance = async (userId) => {
    try {
      const adminToken = localStorage.getItem('adminToken');
      const response = await axios.get(`${API_BASE}/api/performance/user/${userId}`, {
        params: { month: selectedMonth.toString().padStart(2, '0'), year: selectedYear },
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (response.data.success) {
        setUserPerformance(response.data);
      }
    } catch (error) {
      console.error('Error loading user performance:', error);
    }
  };

  const addSupervisorRating = async (userId, rating, comments) => {
    try {
      const adminToken = localStorage.getItem('adminToken');
      await axios.put(`${API_BASE}/api/performance/rate-supervisor/${userId}`, {
        month: selectedMonth.toString().padStart(2, '0'),
        year: selectedYear,
        supervisorRating: rating,
        supervisorComments: comments
      }, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      alert('Supervisor rating added successfully');
      loadUserPerformance(userId);
    } catch (error) {
      alert('Failed to add supervisor rating');
    }
  };

  const addAchievement = async (userId, title, description) => {
    try {
      const adminToken = localStorage.getItem('adminToken');
      await axios.put(`${API_BASE}/api/performance/add-achievement/${userId}`, {
        month: selectedMonth.toString().padStart(2, '0'),
        year: selectedYear,
        title: title,
        description: description
      }, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      alert('Achievement added successfully');
      loadUserPerformance(userId);
    } catch (error) {
      alert('Failed to add achievement');
    }
  };

  const addImprovementArea = async (userId, area, description, priority) => {
    try {
      const adminToken = localStorage.getItem('adminToken');
      await axios.put(`${API_BASE}/api/performance/add-improvement-area/${userId}`, {
        month: selectedMonth.toString().padStart(2, '0'),
        year: selectedYear,
        area: area,
        description: description,
        priority: priority
      }, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      alert('Improvement area added successfully');
      loadUserPerformance(userId);
    } catch (error) {
      alert('Failed to add improvement area');
    }
  };

  const recalculatePerformance = async (userId) => {
    try {
      const adminToken = localStorage.getItem('adminToken');
      await axios.post(`${API_BASE}/api/performance/recalculate/${userId}`, {
        month: selectedMonth.toString().padStart(2, '0'),
        year: selectedYear
      }, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      alert('Performance recalculated successfully');
      loadUserPerformance(userId);
    } catch (error) {
      alert('Failed to recalculate performance');
    }
  };

  const bulkRecalculate = async () => {
    if (!window.confirm('This will recalculate performance for all users. Continue?')) return;
    
    try {
      const adminToken = localStorage.getItem('adminToken');
      await axios.post(`${API_BASE}/api/performance/bulk-recalculate`, {
        month: selectedMonth.toString().padStart(2, '0'),
        year: selectedYear
      }, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      alert('Bulk recalculation completed');
      loadData();
    } catch (error) {
      alert('Failed to bulk recalculate');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Performance Management</h1>
      <button onClick={() => navigate('/admin-dashboard')}>Back to Dashboard</button>
      
      <div>
        <label>Month: </label>
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}>
          {Array.from({length: 12}, (_, i) => (
            <option key={i+1} value={i+1}>
              {new Date(0, i).toLocaleString('default', {month: 'long'})}
            </option>
          ))}
        </select>
        
        <label> Year: </label>
        <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
          <option value="2023">2023</option>
          <option value="2024">2024</option>
          <option value="2025">2025</option>
        </select>

        <button onClick={bulkRecalculate}>Bulk Recalculate All</button>
      </div>
      
      <div>
        <button onClick={() => setView('overview')}>Company Overview</button>
        <button onClick={() => setView('user')}>User Performance</button>
      </div>

      {view === 'overview' && companyOverview && (
        <div>
          <h2>Company Performance Overview</h2>
          <div>
            <h3>Overall Statistics</h3>
            <p>Total Employees: {companyOverview.companyStats.totalEmployees}</p>
            <p>Average Overall Score: {companyOverview.companyStats.averageOverallScore}</p>
            <p>Average Attendance Rate: {companyOverview.companyStats.averageAttendanceRate}%</p>
            <p>Average Task Completion Rate: {companyOverview.companyStats.averageTaskCompletionRate}%</p>
          </div>

          <div>
            <h3>Grade Distribution</h3>
            <table border="1" width="50%">
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Grade A</td>
                  <td>{companyOverview.companyStats.gradeDistribution.A}</td>
                </tr>
                <tr>
                  <td>Grade B</td>
                  <td>{companyOverview.companyStats.gradeDistribution.B}</td>
                </tr>
                <tr>
                  <td>Grade C</td>
                  <td>{companyOverview.companyStats.gradeDistribution.C}</td>
                </tr>
                <tr>
                  <td>Grade D</td>
                  <td>{companyOverview.companyStats.gradeDistribution.D}</td>
                </tr>
                <tr>
                  <td>Grade F</td>
                  <td>{companyOverview.companyStats.gradeDistribution.F}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h3>Department Breakdown</h3>
            <table border="1" width="80%">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Total Employees</th>
                  <th>Average Score</th>
                  <th>Grade A</th>
                  <th>Grade B</th>
                  <th>Grade C</th>
                  <th>Grade D</th>
                  <th>Grade F</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(companyOverview.companyStats.departmentBreakdown || {}).map(([dept, data]) => (
                  <tr key={dept}>
                    <td>{dept}</td>
                    <td>{data.totalEmployees}</td>
                    <td>{data.averageScore}</td>
                    <td>{data.gradeDistribution.A}</td>
                    <td>{data.gradeDistribution.B}</td>
                    <td>{data.gradeDistribution.C}</td>
                    <td>{data.gradeDistribution.D}</td>
                    <td>{data.gradeDistribution.F}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3>Top Performers</h3>
            <table border="1" width="60%">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Overall Score</th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                {companyOverview.topPerformers.map(performer => (
                  <tr key={performer.userId}>
                    <td>{performer.username}</td>
                    <td>{performer.overallScore}</td>
                    <td>{performer.performanceGrade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3>Performance Trends (Last 6 Months)</h3>
            <table border="1" width="70%">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Average Score</th>
                  <th>Employee Count</th>
                </tr>
              </thead>
              <tbody>
                {companyOverview.performanceTrends.map(trend => (
                  <tr key={trend.month}>
                    <td>{trend.month}</td>
                    <td>{trend.averageScore}</td>
                    <td>{trend.employeeCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'user' && (
        <div>
          <h2>User Performance Management</h2>
          <div>
            <label>Select User:</label>
            <br />
            <select 
              value={selectedUser} 
              onChange={(e) => {
                setSelectedUser(e.target.value);
                if (e.target.value) loadUserPerformance(e.target.value);
              }}
            >
              <option value="">Choose an employee</option>
              {users.map(user => (
                <option key={user.userId} value={user.userId}>
                  {user.name} ({user.department})
                </option>
              ))}
            </select>
          </div>

          {userPerformance && (
            <div>
              <h3>Performance for {userPerformance.userInfo.name}</h3>
              <div>
                <h4>Performance Summary</h4>
                <p>Overall Score: {userPerformance.performance.overallScore}/100</p>
                <p>Grade: {userPerformance.performance.performanceGrade}</p>
                <p>Attendance Rate: {userPerformance.performance.attendanceData.attendanceRate}%</p>
                <p>Punctuality Rate: {userPerformance.performance.attendanceData.punctualityRate}%</p>
                <p>Task Completion Rate: {userPerformance.performance.taskData.taskCompletionRate}%</p>
                <p>Average Task Rating: {userPerformance.performance.taskData.averageTaskRating}/5</p>
                <p>Total Working Hours: {userPerformance.performance.attendanceData.totalWorkingHours}</p>
                {userPerformance.performance.supervisorRating && (
                  <div>
                    <p>Supervisor Rating: {userPerformance.performance.supervisorRating}/5</p>
                    <p>Supervisor Comments: {userPerformance.performance.supervisorComments}</p>
                  </div>
                )}
              </div>

              <div>
                <h4>Actions</h4>
                <button onClick={() => {
                  const rating = prompt('Supervisor rating (1-5):');
                  const comments = prompt('Comments:');
                  if (rating && rating >= 1 && rating <= 5) {
                    addSupervisorRating(selectedUser, parseInt(rating), comments);
                  }
                }}>
                  Add Supervisor Rating
                </button>
                {' '}
                <button onClick={() => {
                  const title = prompt('Achievement title:');
                  const description = prompt('Achievement description:');
                  if (title) addAchievement(selectedUser, title, description);
                }}>
                  Add Achievement
                </button>
                {' '}
                <button onClick={() => {
                  const area = prompt('Improvement area:');
                  const description = prompt('Description:');
                  const priority = prompt('Priority (low/medium/high):');
                  if (area) addImprovementArea(selectedUser, area, description, priority || 'medium');
                }}>
                  Add Improvement Area
                </button>
                {' '}
                <button onClick={() => recalculatePerformance(selectedUser)}>
                  Recalculate Performance
                </button>
              </div>

              {userPerformance.performance.achievements && userPerformance.performance.achievements.length > 0 && (
                <div>
                  <h4>Achievements</h4>
                  <ul>
                    {userPerformance.performance.achievements.map((achievement, index) => (
                      <li key={index}>
                        <strong>{achievement.title}</strong>
                        {achievement.description && <p>{achievement.description}</p>}
                        <small>Added: {new Date(achievement.date).toLocaleDateString()}</small>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {userPerformance.performance.improvementAreas && userPerformance.performance.improvementAreas.length > 0 && (
                <div>
                  <h4>Improvement Areas</h4>
                  <ul>
                    {userPerformance.performance.improvementAreas.map((area, index) => (
                      <li key={index}>
                        <strong>{area.area}</strong> ({area.priority})
                        {area.description && <p>{area.description}</p>}
                        <small>Added: {new Date(area.date).toLocaleDateString()}</small>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {userPerformance.performanceHistory && userPerformance.performanceHistory.length > 0 && (
                <div>
                  <h4>Performance History</h4>
                  <table border="1" width="100%">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Overall Score</th>
                        <th>Grade</th>
                        <th>Attendance Rate</th>
                        <th>Task Completion</th>
                        <th>Supervisor Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userPerformance.performanceHistory.map((record, index) => (
                        <tr key={index}>
                          <td>{record.month}</td>
                          <td>{record.overallScore}</td>
                          <td>{record.performanceGrade}</td>
                          <td>{record.attendanceData.attendanceRate}%</td>
                          <td>{record.taskData.taskCompletionRate}%</td>
                          <td>{record.supervisorRating || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPerformanceManagement;