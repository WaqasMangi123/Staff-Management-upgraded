const express = require("express");
const router = express.Router();
const User = require("../models/user");
const UserProfile = require("../models/userprofile");
const Task = require("../models/task");
const Attendance = require("../models/attendance");
const Schedule = require("../models/schedule");
const jwt = require("jsonwebtoken");

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required"
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: "Invalid or expired token"
      });
    }
    req.user = user;
    next();
  });
};

// Admin check middleware
const adminOnly = (req, res, next) => {
  if (req.user.tokenId || req.user.role === 'admin' || req.user.role === 'super_admin') {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    message: "Admin access required"
  });
};

// Helper function to calculate performance metrics
const calculatePerformanceMetrics = async (userId, startDate, endDate) => {
  try {
    console.log(`Calculating performance for user ${userId} from ${startDate} to ${endDate}`);

    // Get attendance records
    const attendanceRecords = await Attendance.find({
      userId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    // Get task records  
    const taskRecords = await Task.find({
      assignedTo: userId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    // Get schedule records
    const scheduleRecords = await Schedule.find({
      userId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    console.log(`Found: ${attendanceRecords.length} attendance, ${taskRecords.length} tasks, ${scheduleRecords.length} schedules`);

    // Calculate attendance metrics
    const totalWorkDays = scheduleRecords.length || attendanceRecords.length;
    const presentDays = attendanceRecords.filter(a => 
      a.status === 'present' || a.status === 'late'
    ).length;
    const lateDays = attendanceRecords.filter(a => a.status === 'late').length;
    const absentDays = attendanceRecords.filter(a => a.status === 'absent').length;
    const leaveDays = attendanceRecords.filter(a => 
      a.status === 'leave' && a.isApproved === true
    ).length;

    // Calculate attendance score
    const attendanceScore = totalWorkDays > 0 ? 
      Math.round((presentDays / totalWorkDays) * 100) : 0;

    // Calculate punctuality score
    const punctualityScore = totalWorkDays > 0 ? 
      Math.round(((totalWorkDays - lateDays) / totalWorkDays) * 100) : 100;

    // Calculate total working hours
    const totalWorkingMinutes = attendanceRecords.reduce((sum, record) => {
      return sum + (record.workingHours || 0);
    }, 0);
    const totalWorkingHours = Math.round(totalWorkingMinutes / 60 * 10) / 10;

    // Calculate task metrics
    const totalTasks = taskRecords.length;
    const completedTasks = taskRecords.filter(t => t.status === 'completed').length;
    const pendingTasks = taskRecords.filter(t => t.status === 'pending').length;
    const inProgressTasks = taskRecords.filter(t => t.status === 'in-progress').length;
    const cancelledTasks = taskRecords.filter(t => t.status === 'cancelled').length;

    const taskCompletionRate = totalTasks > 0 ? 
      Math.round((completedTasks / totalTasks) * 100) : 0;

    // Calculate average task rating
    const ratedTasks = taskRecords.filter(t => 
      t.rating && t.rating > 0 && t.status === 'completed'
    );
    const averageTaskRating = ratedTasks.length > 0 ? 
      Math.round((ratedTasks.reduce((sum, t) => sum + t.rating, 0) / ratedTasks.length) * 10) / 10 : 0;

    const metrics = {
      // Attendance metrics
      attendanceScore,
      punctualityScore,
      totalWorkingHours,
      lateArrivals: lateDays,
      absences: absentDays,
      approvedLeaves: leaveDays,
      
      // Task metrics
      taskCompletionRate,
      averageTaskRating,
      totalTasks,
      completedTasks,
      pendingTasks,
      inProgressTasks,
      cancelledTasks,

      // Additional metrics
      totalWorkDays,
      presentDays
    };

    console.log(`Calculated metrics:`, metrics);
    return metrics;

  } catch (error) {
    console.error("Error calculating performance metrics:", error);
    throw error;
  }
};

// Helper function to get date range
const getDateRange = (month, year) => {
  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const lastDay = new Date(year, parseInt(month), 0).getDate();
  const endDate = `${year}-${month.padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
  return { startDate, endDate };
};

// 🔹 GET /api/performance/my-performance - Get current user's performance
router.get("/my-performance", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { month, year } = req.query;

    // Default to current month if not provided
    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1).toString().padStart(2, '0');
    const targetYear = year || now.getFullYear().toString();

    console.log(`Getting performance for user ${userId}, month ${targetMonth}, year ${targetYear}`);

    // Get date range
    const { startDate, endDate } = getDateRange(targetMonth, targetYear);

    // Calculate performance metrics
    const performance = await calculatePerformanceMetrics(userId, startDate, endDate);

    // Get user info
    const user = await User.findById(userId).select('username email');
    const profile = await UserProfile.findOne({ userId });

    // Get performance history (last 6 months)
    const historyPromises = [];
    for (let i = 5; i >= 0; i--) {
      const historyDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const historyMonth = (historyDate.getMonth() + 1).toString().padStart(2, '0');
      const historyYear = historyDate.getFullYear().toString();
      
      if (historyMonth !== targetMonth || historyYear !== targetYear) {
        const { startDate: hStart, endDate: hEnd } = getDateRange(historyMonth, historyYear);
        historyPromises.push(
          calculatePerformanceMetrics(userId, hStart, hEnd).then(metrics => ({
            month: `${historyYear}-${historyMonth}`,
            ...metrics
          })).catch(() => ({
            month: `${historyYear}-${historyMonth}`,
            attendanceScore: 0,
            taskCompletionRate: 0,
            punctualityScore: 0,
            totalWorkingHours: 0
          }))
        );
      }
    }

    const performanceHistory = await Promise.all(historyPromises);

    const response = {
      success: true,
      performance: {
        userId,
        month: `${targetYear}-${targetMonth}`,
        ...performance,
        calculatedAt: new Date()
      },
      performanceHistory: performanceHistory.sort((a, b) => b.month.localeCompare(a.month)),
      userInfo: {
        username: user?.username || 'Unknown',
        email: user?.email || 'Unknown',
        name: profile?.name || user?.username || 'Unknown',
        department: profile?.department || 'Not Set',
        jobTitle: profile?.jobTitle || 'Not Set'
      }
    };

    console.log(`Returning performance data for user ${userId}`);
    res.status(200).json(response);

  } catch (error) {
    console.error("Get my performance error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get performance data",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 🔹 GET /api/performance/admin/all-users - Get all users performance (admin only)
router.get("/admin/all-users", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { month, year, department, limit = 50 } = req.query;

    // Default to current month
    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1).toString().padStart(2, '0');
    const targetYear = year || now.getFullYear().toString();

    console.log(`Admin getting all performance for month ${targetYear}-${targetMonth}`);

    // Get date range
    const { startDate, endDate } = getDateRange(targetMonth, targetYear);

    // Get all users with profiles
    let userQuery = { role: { $ne: 'admin' }, verified: true };
    const users = await User.find(userQuery).select('_id username email').limit(parseInt(limit));

    const performancePromises = users.map(async (user) => {
      try {
        // Get user profile
        const profile = await UserProfile.findOne({ userId: user._id });
        
        // Skip if department filter doesn't match
        if (department && department !== 'all' && profile?.department !== department) {
          return null;
        }

        // Calculate performance
        const performance = await calculatePerformanceMetrics(user._id, startDate, endDate);

        return {
          userId: user._id,
          userInfo: {
            username: user.username,
            email: user.email,
            name: profile?.name || user.username,
            department: profile?.department || 'Not Set',
            jobTitle: profile?.jobTitle || 'Not Set'
          },
          month: `${targetYear}-${targetMonth}`,
          ...performance,
          calculatedAt: new Date()
        };
      } catch (error) {
        console.error(`Failed to calculate performance for user ${user._id}:`, error.message);
        return {
          userId: user._id,
          userInfo: {
            username: user.username,
            email: user.email,
            name: user.username,
            department: 'Not Set',
            jobTitle: 'Not Set'
          },
          month: `${targetYear}-${targetMonth}`,
          attendanceScore: 0,
          taskCompletionRate: 0,
          punctualityScore: 0,
          totalWorkingHours: 0,
          error: error.message
        };
      }
    });

    const allPerformance = (await Promise.all(performancePromises)).filter(p => p !== null);

    res.status(200).json({
      success: true,
      month: `${targetYear}-${targetMonth}`,
      performance: allPerformance,
      summary: {
        totalUsers: allPerformance.length,
        dateRange: { startDate, endDate },
        department: department || 'all'
      }
    });

  } catch (error) {
    console.error("Get all users performance error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get performance data for all users",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 🔹 GET /api/performance/admin/user/:userId - Get specific user performance (admin only)
router.get("/admin/user/:userId", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { userId } = req.params;
    const { month, year } = req.query;

    // Default to current month
    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1).toString().padStart(2, '0');
    const targetYear = year || now.getFullYear().toString();

    console.log(`Admin getting performance for user ${userId}, month ${targetMonth}, year ${targetYear}`);

    // Get date range
    const { startDate, endDate } = getDateRange(targetMonth, targetYear);

    // Get user info
    const user = await User.findById(userId).select('username email');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const profile = await UserProfile.findOne({ userId });

    // Calculate performance metrics
    const performance = await calculatePerformanceMetrics(userId, startDate, endDate);

    // Get performance history (last 6 months)
    const historyPromises = [];
    for (let i = 5; i >= 0; i--) {
      const historyDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const historyMonth = (historyDate.getMonth() + 1).toString().padStart(2, '0');
      const historyYear = historyDate.getFullYear().toString();
      
      const { startDate: hStart, endDate: hEnd } = getDateRange(historyMonth, historyYear);
      historyPromises.push(
        calculatePerformanceMetrics(userId, hStart, hEnd).then(metrics => ({
          month: `${historyYear}-${historyMonth}`,
          ...metrics
        })).catch(() => ({
          month: `${historyYear}-${historyMonth}`,
          attendanceScore: 0,
          taskCompletionRate: 0,
          punctualityScore: 0,
          totalWorkingHours: 0
        }))
      );
    }

    const performanceHistory = await Promise.all(historyPromises);

    const response = {
      success: true,
      performance: {
        userId,
        month: `${targetYear}-${targetMonth}`,
        ...performance,
        calculatedAt: new Date()
      },
      performanceHistory: performanceHistory.sort((a, b) => b.month.localeCompare(a.month)),
      userInfo: {
        username: user.username,
        email: user.email,
        name: profile?.name || user.username,
        department: profile?.department || 'Not Set',
        jobTitle: profile?.jobTitle || 'Not Set'
      }
    };

    res.status(200).json(response);

  } catch (error) {
    console.error("Get user performance error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user performance data",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 🔹 GET /api/performance/departments - Get department-wise performance summary (admin only)
router.get("/departments", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { month, year } = req.query;

    // Default to current month
    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1).toString().padStart(2, '0');
    const targetYear = year || now.getFullYear().toString();

    // Get date range
    const { startDate, endDate } = getDateRange(targetMonth, targetYear);

    // Get all profiles to get departments
    const profiles = await UserProfile.find({}).populate('userId', 'username email verified');
    
    const departmentMap = {};

    for (const profile of profiles) {
      if (!profile.userId || !profile.userId.verified || profile.userId.role === 'admin') continue;

      const department = profile.department || 'Not Set';
      
      if (!departmentMap[department]) {
        departmentMap[department] = {
          department,
          users: [],
          totalEmployees: 0,
          performanceData: []
        };
      }

      try {
        const performance = await calculatePerformanceMetrics(profile.userId._id, startDate, endDate);
        departmentMap[department].users.push({
          userId: profile.userId._id,
          userInfo: {
            username: profile.userId.username,
            email: profile.userId.email,
            name: profile.name,
            department: profile.department,
            jobTitle: profile.jobTitle
          },
          ...performance
        });
        departmentMap[department].performanceData.push(performance);
      } catch (error) {
        console.error(`Failed to calculate performance for user ${profile.userId._id}:`, error.message);
      }

      departmentMap[department].totalEmployees++;
    }

    // Calculate department averages
    const departments = Object.values(departmentMap).map(dept => {
      const data = dept.performanceData;
      if (data.length === 0) {
        return {
          department: dept.department,
          totalEmployees: dept.totalEmployees,
          averageAttendance: 0,
          averageTaskCompletion: 0,
          averageTaskRating: 0,
          averagePunctuality: 0,
          topPerformer: null
        };
      }

      const averageAttendance = Math.round(data.reduce((sum, d) => sum + d.attendanceScore, 0) / data.length);
      const averageTaskCompletion = Math.round(data.reduce((sum, d) => sum + d.taskCompletionRate, 0) / data.length);
      const averageTaskRating = Math.round(data.reduce((sum, d) => sum + d.averageTaskRating, 0) / data.length * 10) / 10;
      const averagePunctuality = Math.round(data.reduce((sum, d) => sum + d.punctualityScore, 0) / data.length);

      // Find top performer
      const topPerformer = dept.users.reduce((top, current) => {
        const topScore = (top.attendanceScore + top.taskCompletionRate) / 2;
        const currentScore = (current.attendanceScore + current.taskCompletionRate) / 2;
        return currentScore > topScore ? current : top;
      }, dept.users[0]);

      return {
        department: dept.department,
        totalEmployees: dept.totalEmployees,
        averageAttendance,
        averageTaskCompletion,
        averageTaskRating,
        averagePunctuality,
        topPerformer
      };
    });

    res.status(200).json({
      success: true,
      month: `${targetYear}-${targetMonth}`,
      departments: departments.sort((a, b) => b.averageAttendance - a.averageAttendance)
    });

  } catch (error) {
    console.error("Get departments performance error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get department performance data",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 🔹 GET /api/performance/debug/:userId - Debug specific user data
router.get("/debug/:userId", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { userId } = req.params;
    const { month, year } = req.query;

    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1).toString().padStart(2, '0');
    const targetYear = year || now.getFullYear().toString();
    
    const { startDate, endDate } = getDateRange(targetMonth, targetYear);

    console.log(`Debug data for user ${userId} from ${startDate} to ${endDate}`);

    const user = await User.findById(userId);
    const profile = await UserProfile.findOne({ userId });
    
    const attendanceRecords = await Attendance.find({
      userId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    const taskRecords = await Task.find({
      assignedTo: userId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    const scheduleRecords = await Schedule.find({
      userId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    res.json({
      success: true,
      debug: {
        userId,
        dateRange: { startDate, endDate },
        user: user ? { username: user.username, email: user.email } : null,
        profile: profile ? { name: profile.name, department: profile.department } : null,
        counts: {
          attendance: attendanceRecords.length,
          tasks: taskRecords.length,
          schedules: scheduleRecords.length
        },
        attendance: attendanceRecords.map(a => ({
          date: a.date,
          status: a.status,
          workingHours: a.workingHours
        })),
        tasks: taskRecords.map(t => ({
          date: t.date,
          title: t.title,
          status: t.status,
          rating: t.rating
        })),
        schedules: scheduleRecords.map(s => ({
          date: s.date,
          shift: s.shift,
          status: s.status
        }))
      }
    });

  } catch (error) {
    console.error("Debug error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 🔹 POST /api/performance/admin/recalculate - Force recalculate performance
router.post("/admin/recalculate", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { month, year, userId } = req.body;

    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1).toString().padStart(2, '0');
    const targetYear = year || now.getFullYear().toString();

    const { startDate, endDate } = getDateRange(targetMonth, targetYear);

    let users = [];
    if (userId) {
      const user = await User.findById(userId);
      if (user) users = [user];
    } else {
      users = await User.find({ role: { $ne: 'admin' }, verified: true });
    }

    const results = [];
    for (const user of users.slice(0, 20)) { // Limit to prevent timeout
      try {
        const performance = await calculatePerformanceMetrics(user._id, startDate, endDate);
        results.push({
          userId: user._id,
          username: user.username,
          performance,
          status: 'success'
        });
      } catch (error) {
        results.push({
          userId: user._id,
          username: user.username,
          error: error.message,
          status: 'error'
        });
      }
    }

    res.json({
      success: true,
      message: `Performance recalculated for ${results.filter(r => r.status === 'success').length} users`,
      results,
      month: `${targetYear}-${targetMonth}`,
      dateRange: { startDate, endDate }
    });

  } catch (error) {
    console.error("Recalculate error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to recalculate performance",
      error: error.message
    });
  }
});

// Test route
router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Performance routes are working!",
    timestamp: new Date().toISOString(),
    availableRoutes: [
      'GET /my-performance',
      'GET /admin/all-users', 
      'GET /admin/user/:userId',
      'GET /departments',
      'GET /debug/:userId',
      'POST /admin/recalculate'
    ]
  });
});

module.exports = router;