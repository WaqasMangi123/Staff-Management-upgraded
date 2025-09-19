import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const UserPerformance = () => {
  const [performance, setPerformance] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const navigate = useNavigate();
  const API_BASE = 'https://staff-management-upgraded.onrender.com';

  useEffect(() => {
    loadPerformance();
  }, [selectedMonth, selectedYear]);

  const loadPerformance = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/api/performance/my-performance`, {
        params: { month: selectedMonth.toString().padStart(2, '0'), year: selectedYear },
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setPerformance(response.data.performance);
        setHistory(response.data.performanceHistory || []);
      }
    } catch (error) {
      console.error('Error loading performance:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading performance data...</div>;

  return (
    <div>
      <h1>My Performance</h1>
      <button onClick={() => navigate('/user/home')}>Back to Home</button>
      
      <div>
        <label>Month: </label>
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}>
          {Array.from({length: 12}, (_, i) => (
            <option key={i+1} value={i+1}>
              {new Date(0, i).toLocaleString('default', {month: 'long'})}
            </option>
          ))}
        </select>
        
        <label>Year: </label>
        <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
          <option value="2023">2023</option>
          <option value="2024">2024</option>
          <option value="2025">2025</option>
        </select>
      </div>

      {performance ? (
        <div>
          <h2>Performance for {selectedMonth}/{selectedYear}</h2>
          <div>
            <h3>Overall Score: {performance.overallScore}/100 (Grade: {performance.performanceGrade})</h3>
          </div>
          
          <div>
            <h3>Attendance Data</h3>
            <table border="1">
              <tr>
                <td>Total Days</td>
                <td>{performance.attendanceData.totalDays}</td>
              </tr>
              <tr>
                <td>Present Days</td>
                <td>{performance.attendanceData.presentDays}</td>
              </tr>
              <tr>
                <td>Attendance Rate</td>
                <td>{performance.attendanceData.attendanceRate}%</td>
              </tr>
              <tr>
                <td>Punctuality Rate</td>
                <td>{performance.attendanceData.punctualityRate}%</td>
              </tr>
              <tr>
                <td>Total Working Hours</td>
                <td>{performance.attendanceData.totalWorkingHours}</td>
              </tr>
            </table>
          </div>

          <div>
            <h3>Task Performance</h3>
            <table border="1">
              <tr>
                <td>Total Tasks</td>
                <td>{performance.taskData.totalTasks}</td>
              </tr>
              <tr>
                <td>Completed Tasks</td>
                <td>{performance.taskData.completedTasks}</td>
              </tr>
              <tr>
                <td>Task Completion Rate</td>
                <td>{performance.taskData.taskCompletionRate}%</td>
              </tr>
              <tr>
                <td>Average Task Rating</td>
                <td>{performance.taskData.averageTaskRating}/5</td>
              </tr>
            </table>
          </div>

          {performance.supervisorRating && (
            <div>
              <h3>Supervisor Feedback</h3>
              <p><strong>Rating:</strong> {performance.supervisorRating}/5</p>
              <p><strong>Comments:</strong> {performance.supervisorComments}</p>
            </div>
          )}

          {performance.achievements && performance.achievements.length > 0 && (
            <div>
              <h3>Achievements</h3>
              <ul>
                {performance.achievements.map((achievement, index) => (
                  <li key={index}>
                    <strong>{achievement.title}</strong>
                    {achievement.description && <p>{achievement.description}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {performance.improvementAreas && performance.improvementAreas.length > 0 && (
            <div>
              <h3>Areas for Improvement</h3>
              <ul>
                {performance.improvementAreas.map((area, index) => (
                  <li key={index}>
                    <strong>{area.area}</strong> ({area.priority})
                    {area.description && <p>{area.description}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p>No performance data available for this period</p>
      )}

      {history.length > 0 && (
        <div>
          <h2>Performance History</h2>
          <table border="1">
            <thead>
              <tr>
                <th>Month</th>
                <th>Overall Score</th>
                <th>Grade</th>
                <th>Attendance Rate</th>
                <th>Task Completion Rate</th>
              </tr>
            </thead>
            <tbody>
              {history.map((record, index) => (
                <tr key={index}>
                  <td>{record.month}</td>
                  <td>{record.overallScore}</td>
                  <td>{record.performanceGrade}</td>
                  <td>{record.attendanceData.attendanceRate}%</td>
                  <td>{record.taskData.taskCompletionRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default UserPerformance;