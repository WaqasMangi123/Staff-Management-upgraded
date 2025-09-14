const express = require("express");
const router = express.Router();
const Performance = require("../models/performance");
const Attendance = require("../models/attendance");
const Task = require("../models/task");
const User = require("../models/user");
const UserProfile = require("../models/userprofile");
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
 if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: "Admin access required"
    });
  }
  next();
};

// Helper function to calculate user performance
const calculateUserPerformance = async (userId, month, year) => {
  try {
    const monthKey = `${year}-${month}`;
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    // Get attendance data for the month
    const attendanceRecords = await Attendance.find({
      userId,
      date: { $gte: startDate, $lte: endDate }
    });

    // Get task data for the month
    const tasks = await Task.find({
      assignedTo: userId,
      date: { $gte: startDate, $lte: endDate }
    });

    // Calculate attendance metrics
    const totalDays = attendanceRecords.length;
    const presentDays = attendanceRecords.filter(a => a.status === 'present').length;
    const lateDays = attendanceRecords.filter(a => a.isLate).length;
    const totalWorkingHours = attendanceRecords.reduce((sum, a) => sum + (a.hoursWorked || 0), 0);
    
    const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
    const punctualityRate = totalDays > 0 ? Math.round(((totalDays - lateDays) / totalDays) * 100) : 0;
    const averageHoursPerDay = totalDays > 0 ? Math.round((totalWorkingHours / totalDays) * 10) / 10 : 0;

    // Calculate task metrics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Calculate average task rating
    const ratedTasks = tasks.filter(t => t.rating && t.status === 'completed');
    const averageTaskRating = ratedTasks.length > 0 ? 
      Math.round((ratedTasks.reduce((sum, t) => sum + t.rating, 0) / ratedTasks.length) * 10) / 10 : 0;

    // Calculate overall performance score (weighted average)
    const attendanceWeight = 0.3;
    const punctualityWeight = 0.2;
    const taskCompletionWeight = 0.3;
    const taskQualityWeight = 0.2;

    const overallScore = Math.round((
      (attendanceRate * attendanceWeight) +
      (punctualityRate * punctualityWeight) +
      (taskCompletionRate * taskCompletionWeight) +
      ((averageTaskRating / 5) * 100 * taskQualityWeight)
    ));

    // Performance grade based on overall score
    let performanceGrade = 'F';
    if (overallScore >= 90) performanceGrade = 'A';
    else if (overallScore >= 80) performanceGrade = 'B';
    else if (overallScore >= 70) performanceGrade = 'C';
    else if (overallScore >= 60) performanceGrade = 'D';

    // Check if performance record already exists
    let performance = await Performance.findOne({ userId, month: monthKey });

    if (performance) {
      // Update existing record
      performance.attendanceData = {
        totalDays,
        presentDays,
        lateDays,
        attendanceRate,
        punctualityRate,
        totalWorkingHours,
        averageHoursPerDay
      };
      performance.taskData = {
        totalTasks,
        completedTasks,
        taskCompletionRate,
        averageTaskRating,
        totalRatedTasks: ratedTasks.length
      };
      performance.overallScore = overallScore;
      performance.performanceGrade = performanceGrade;
      performance.lastCalculated = new Date();
    } else {
      // Create new record
      performance = new Performance({
        userId,
        month: monthKey,
        attendanceData: {
          totalDays,
          presentDays,
          lateDays,
          attendanceRate,
          punctualityRate,
          totalWorkingHours,
          averageHoursPerDay
        },
        taskData: {
          totalTasks,
          completedTasks,
          taskCompletionRate,
          averageTaskRating,
          totalRatedTasks: ratedTasks.length
        },
        overallScore,
        performanceGrade,
        supervisorRating: null,
        supervisorComments: '',
        achievements: [],
        improvementAreas: [],
        lastCalculated: new Date()
      });
    }

    await performance.save();
    return performance;

  } catch (error) {
    console.error("Calculate performance error:", error);
    throw error;
  }
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
    const monthKey = `${targetYear}-${targetMonth}`;

    let performance = await Performance.findOne({ userId, month: monthKey });

    if (!performance) {
      // Calculate and create performance record
      performance = await calculateUserPerformance(userId, targetMonth, targetYear);
    }

    // Get recent performance history (last 6 months)
    const historyMonths = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const historyMonth = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      historyMonths.push(historyMonth);
    }

    const performanceHistory = await Performance.find({
      userId,
      month: { $in: historyMonths }
    }).sort({ month: -1 });

    res.status(200).json({
      success: true,
      performance,
      performanceHistory,
      month: monthKey
    });

  } catch (error) {
    console.error("Get my performance error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch performance data"
    });
  }
});

// 🔹 GET /api/performance/user/:userId - Get user's performance (admin only)
router.get("/user/:userId", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { userId } = req.params;
    const { month, year } = req.query;

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Default to current month if not provided
    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1).toString().padStart(2, '0');
    const targetYear = year || now.getFullYear().toString();
    const monthKey = `${targetYear}-${targetMonth}`;

    let performance = await Performance.findOne({ userId, month: monthKey });

    if (!performance) {
      // Calculate and create performance record
      performance = await calculateUserPerformance(userId, targetMonth, targetYear);
    }

    // Get user profile for additional context
    const profile = await UserProfile.findOne({ userId });

    // Get performance history
    const performanceHistory = await Performance.find({ userId })
      .sort({ month: -1 })
      .limit(12); // Last 12 months

    res.status(200).json({
      success: true,
      performance,
      performanceHistory,
      userInfo: {
        username: user.username,
        email: user.email,
        name: profile?.name || user.username,
        department: profile?.department,
        jobTitle: profile?.jobTitle,
        employeeId: profile?.employeeId
      },
      month: monthKey
    });

  } catch (error) {
    console.error("Get user performance error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user performance"
    });
  }
});

// 🔹 GET /api/performance/department/:department - Get department performance summary (admin only)
router.get("/department/:department", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { department } = req.params;
    const { month, year } = req.query;

    // Default to current month if not provided
    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1).toString().padStart(2, '0');
    const targetYear = year || now.getFullYear().toString();
    const monthKey = `${targetYear}-${targetMonth}`;

    // Get all users in the department
    const departmentUsers = await UserProfile.find({ department })
      .populate('userId', 'username email');

    if (departmentUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No users found in this department"
      });
    }

    const userIds = departmentUsers.map(u => u.userId._id);

    // Get performance data for all users in department
    const performanceRecords = await Performance.find({
      userId: { $in: userIds },
      month: monthKey
    }).populate('userId', 'username email');

    // Calculate missing performance records
    const missingUserIds = userIds.filter(id => 
      !performanceRecords.find(p => p.userId._id.toString() === id.toString())
    );

    // Calculate performance for missing users
    for (const userId of missingUserIds) {
      try {
        const performance = await calculateUserPerformance(userId, targetMonth, targetYear);
        performanceRecords.push(performance);
      } catch (error) {
        console.log(`Failed to calculate performance for user ${userId}:`, error.message);
      }
    }

    // Calculate department statistics
    const departmentStats = {
      totalEmployees: performanceRecords.length,
      averageOverallScore: 0,
      averageAttendanceRate: 0,
      averagePunctualityRate: 0,
      averageTaskCompletionRate: 0,
      gradeDistribution: { A: 0, B: 0, C: 0, D: 0, F: 0 },
      topPerformers: [],
      needsImprovement: []
    };

    if (performanceRecords.length > 0) {
      // Calculate averages
      const totalOverallScore = performanceRecords.reduce((sum, p) => sum + p.overallScore, 0);
      const totalAttendanceRate = performanceRecords.reduce((sum, p) => sum + p.attendanceData.attendanceRate, 0);
      const totalPunctualityRate = performanceRecords.reduce((sum, p) => sum + p.attendanceData.punctualityRate, 0);
      const totalTaskCompletionRate = performanceRecords.reduce((sum, p) => sum + p.taskData.taskCompletionRate, 0);

      departmentStats.averageOverallScore = Math.round(totalOverallScore / performanceRecords.length);
      departmentStats.averageAttendanceRate = Math.round(totalAttendanceRate / performanceRecords.length);
      departmentStats.averagePunctualityRate = Math.round(totalPunctualityRate / performanceRecords.length);
      departmentStats.averageTaskCompletionRate = Math.round(totalTaskCompletionRate / performanceRecords.length);

      // Count grade distribution
      performanceRecords.forEach(p => {
        departmentStats.gradeDistribution[p.performanceGrade]++;
      });

      // Get top performers (grade A or B with score > 85)
      departmentStats.topPerformers = performanceRecords
        .filter(p => ['A', 'B'].includes(p.performanceGrade) && p.overallScore > 85)
        .sort((a, b) => b.overallScore - a.overallScore)
        .slice(0, 5)
        .map(p => ({
          userId: p.userId._id,
          username: p.userId.username,
          overallScore: p.overallScore,
          performanceGrade: p.performanceGrade
        }));

      // Get employees needing improvement (grade D or F, or score < 70)
      departmentStats.needsImprovement = performanceRecords
        .filter(p => ['D', 'F'].includes(p.performanceGrade) || p.overallScore < 70)
        .sort((a, b) => a.overallScore - b.overallScore)
        .slice(0, 5)
        .map(p => ({
          userId: p.userId._id,
          username: p.userId.username,
          overallScore: p.overallScore,
          performanceGrade: p.performanceGrade
        }));
    }

    res.status(200).json({
      success: true,
      department,
      month: monthKey,
      departmentStats,
      performanceRecords: performanceRecords.map(p => ({
        userId: p.userId._id,
        username: p.userId.username,
        overallScore: p.overallScore,
        performanceGrade: p.performanceGrade,
        attendanceRate: p.attendanceData.attendanceRate,
        taskCompletionRate: p.taskData.taskCompletionRate,
        supervisorRating: p.supervisorRating
      }))
    });

  } catch (error) {
    console.error("Get department performance error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch department performance"
    });
  }
});

// 🔹 GET /api/performance/company-overview - Get company-wide performance overview (admin only)
router.get("/company-overview", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { month, year } = req.query;

    // Default to current month if not provided
    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1).toString().padStart(2, '0');
    const targetYear = year || now.getFullYear().toString();
    const monthKey = `${targetYear}-${targetMonth}`;

    // Get all performance records for the month
    const allPerformance = await Performance.find({ month: monthKey })
      .populate('userId', 'username email');

    // Get all users to check for missing performance records
    const allUsers = await User.find({ role: { $ne: 'admin' } }).select('_id');
    const missingUserIds = allUsers
      .map(u => u._id)
      .filter(id => !allPerformance.find(p => p.userId._id.toString() === id.toString()));

    // Calculate performance for missing users
    for (const userId of missingUserIds) {
      try {
        const performance = await calculateUserPerformance(userId, targetMonth, targetYear);
        allPerformance.push(performance);
      } catch (error) {
        console.log(`Failed to calculate performance for user ${userId}:`, error.message);
      }
    }

    // Company-wide statistics
    const companyStats = {
      totalEmployees: allPerformance.length,
      averageOverallScore: 0,
      averageAttendanceRate: 0,
      averagePunctualityRate: 0,
      averageTaskCompletionRate: 0,
      gradeDistribution: { A: 0, B: 0, C: 0, D: 0, F: 0 },
      departmentBreakdown: {}
    };

    if (allPerformance.length > 0) {
      // Calculate company averages
      const totalOverallScore = allPerformance.reduce((sum, p) => sum + p.overallScore, 0);
      const totalAttendanceRate = allPerformance.reduce((sum, p) => sum + p.attendanceData.attendanceRate, 0);
      const totalPunctualityRate = allPerformance.reduce((sum, p) => sum + p.attendanceData.punctualityRate, 0);
      const totalTaskCompletionRate = allPerformance.reduce((sum, p) => sum + p.taskData.taskCompletionRate, 0);

      companyStats.averageOverallScore = Math.round(totalOverallScore / allPerformance.length);
      companyStats.averageAttendanceRate = Math.round(totalAttendanceRate / allPerformance.length);
      companyStats.averagePunctualityRate = Math.round(totalPunctualityRate / allPerformance.length);
      companyStats.averageTaskCompletionRate = Math.round(totalTaskCompletionRate / allPerformance.length);

      // Count grade distribution
      allPerformance.forEach(p => {
        companyStats.gradeDistribution[p.performanceGrade]++;
      });
    }

    // Get department breakdown
    const departments = await UserProfile.distinct('department');
    for (const dept of departments) {
      if (dept) {
        const deptUsers = await UserProfile.find({ department: dept }).select('userId');
        const deptUserIds = deptUsers.map(u => u.userId);
        const deptPerformance = allPerformance.filter(p => 
          deptUserIds.some(id => id.toString() === p.userId._id.toString())
        );

        if (deptPerformance.length > 0) {
          const deptAvgScore = Math.round(
            deptPerformance.reduce((sum, p) => sum + p.overallScore, 0) / deptPerformance.length
          );
          const deptGrades = { A: 0, B: 0, C: 0, D: 0, F: 0 };
          deptPerformance.forEach(p => deptGrades[p.performanceGrade]++);

          companyStats.departmentBreakdown[dept] = {
            totalEmployees: deptPerformance.length,
            averageScore: deptAvgScore,
            gradeDistribution: deptGrades
          };
        }
      }
    }

    // Top company performers
    const topPerformers = allPerformance
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, 10)
      .map(p => ({
        userId: p.userId._id,
        username: p.userId.username,
        overallScore: p.overallScore,
        performanceGrade: p.performanceGrade
      }));

    // Performance trends (last 6 months)
    const trendMonths = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const trendMonth = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      trendMonths.push(trendMonth);
    }

    const performanceTrends = [];
    for (const month of trendMonths) {
      const monthPerformance = await Performance.find({ month });
      const monthAvg = monthPerformance.length > 0 ? 
        Math.round(monthPerformance.reduce((sum, p) => sum + p.overallScore, 0) / monthPerformance.length) : 0;
      
      performanceTrends.push({
        month,
        averageScore: monthAvg,
        employeeCount: monthPerformance.length
      });
    }

    res.status(200).json({
      success: true,
      month: monthKey,
      companyStats,
      topPerformers,
      performanceTrends,
      totalRecords: allPerformance.length
    });

  } catch (error) {
    console.error("Get company overview error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch company performance overview"
    });
  }
});

// 🔹 PUT /api/performance/rate-supervisor/:userId - Add supervisor rating (admin only)
router.put("/rate-supervisor/:userId", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { userId } = req.params;
    const { month, year, supervisorRating, supervisorComments } = req.body;

    if (!supervisorRating || supervisorRating < 1 || supervisorRating > 5) {
      return res.status(400).json({
        success: false,
        message: "Supervisor rating must be between 1 and 5"
      });
    }

    // Default to current month if not provided
    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1).toString().padStart(2, '0');
    const targetYear = year || now.getFullYear().toString();
    const monthKey = `${targetYear}-${targetMonth}`;

    let performance = await Performance.findOne({ userId, month: monthKey });

    if (!performance) {
      // Calculate and create performance record first
      performance = await calculateUserPerformance(userId, targetMonth, targetYear);
    }

    // Update supervisor rating
    performance.supervisorRating = supervisorRating;
    performance.supervisorComments = supervisorComments || '';
    performance.ratedBy = req.user.id;
    performance.ratedAt = new Date();
    
    await performance.save();

    // Get user info for response
    const user = await User.findById(userId).select('username email');

    res.status(200).json({
      success: true,
      message: "Supervisor rating updated successfully",
      performance,
      userInfo: {
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error("Rate supervisor error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update supervisor rating"
    });
  }
});

// 🔹 PUT /api/performance/add-achievement/:userId - Add achievement (admin only)
router.put("/add-achievement/:userId", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { userId } = req.params;
    const { month, year, title, description, category } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Achievement title is required"
      });
    }

    // Default to current month if not provided
    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1).toString().padStart(2, '0');
    const targetYear = year || now.getFullYear().toString();
    const monthKey = `${targetYear}-${targetMonth}`;

    let performance = await Performance.findOne({ userId, month: monthKey });

    if (!performance) {
      performance = await calculateUserPerformance(userId, targetMonth, targetYear);
    }

    // Add achievement
    const achievement = {
      title: title.trim(),
      description: description?.trim() || '',
      category: category || 'General',
      date: new Date(),
      addedBy: req.user.id
    };

    performance.achievements.push(achievement);
    await performance.save();

    res.status(200).json({
      success: true,
      message: "Achievement added successfully",
      achievement,
      totalAchievements: performance.achievements.length
    });

  } catch (error) {
    console.error("Add achievement error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add achievement"
    });
  }
});

// 🔹 PUT /api/performance/add-improvement-area/:userId - Add improvement area (admin only)
router.put("/add-improvement-area/:userId", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { userId } = req.params;
    const { month, year, area, description, priority } = req.body;

    if (!area) {
      return res.status(400).json({
        success: false,
        message: "Improvement area is required"
      });
    }

    // Default to current month if not provided
    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1).toString().padStart(2, '0');
    const targetYear = year || now.getFullYear().toString();
    const monthKey = `${targetYear}-${targetMonth}`;

    let performance = await Performance.findOne({ userId, month: monthKey });

    if (!performance) {
      performance = await calculateUserPerformance(userId, targetMonth, targetYear);
    }

    // Add improvement area
    const improvementArea = {
      area: area.trim(),
      description: description?.trim() || '',
      priority: priority || 'medium',
      date: new Date(),
      addedBy: req.user.id
    };

    performance.improvementAreas.push(improvementArea);
    await performance.save();

    res.status(200).json({
      success: true,
      message: "Improvement area added successfully",
      improvementArea,
      totalImprovementAreas: performance.improvementAreas.length
    });

  } catch (error) {
    console.error("Add improvement area error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add improvement area"
    });
  }
});

// 🔹 POST /api/performance/recalculate/:userId - Recalculate user performance (admin only)
router.post("/recalculate/:userId", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { userId } = req.params;
    const { month, year } = req.body;

    // Default to current month if not provided
    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1).toString().padStart(2, '0');
    const targetYear = year || now.getFullYear().toString();

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Recalculate performance
    const performance = await calculateUserPerformance(userId, targetMonth, targetYear);

    res.status(200).json({
      success: true,
      message: "Performance recalculated successfully",
      performance,
      userInfo: {
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error("Recalculate performance error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to recalculate performance"
    });
  }
});

// 🔹 POST /api/performance/bulk-recalculate - Recalculate all users' performance (admin only)
router.post("/bulk-recalculate", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { month, year } = req.body;

    // Default to current month if not provided
    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1).toString().padStart(2, '0');
    const targetYear = year || now.getFullYear().toString();

    // Get all non-admin users
    const users = await User.find({ role: { $ne: 'admin' } }).select('_id username');

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    // Recalculate for each user
    for (const user of users) {
      try {
        await calculateUserPerformance(user._id, targetMonth, targetYear);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          userId: user._id,
          username: user.username,
          error: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk recalculation completed. ${results.success} successful, ${results.failed} failed.`,
      results
    });

  } catch (error) {
    console.error("Bulk recalculate error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to bulk recalculate performance"
    });
  }
});

// 🔹 DELETE /api/performance/achievement/:userId/:achievementId - Remove achievement (admin only)
router.delete("/achievement/:userId/:achievementId", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { userId, achievementId } = req.params;

    const performance = await Performance.findOne({ userId });
    if (!performance) {
      return res.status(404).json({
        success: false,
        message: "Performance record not found"
      });
    }

    // Remove achievement
    performance.achievements = performance.achievements.filter(
      achievement => achievement._id.toString() !== achievementId
    );

    await performance.save();

    res.status(200).json({
      success: true,
      message: "Achievement removed successfully",
      remainingAchievements: performance.achievements.length
    });

  } catch (error) {
    console.error("Remove achievement error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove achievement"
    });
  }
});

// 🔹 DELETE /api/performance/improvement-area/:userId/:areaId - Remove improvement area (admin only)
router.delete("/improvement-area/:userId/:areaId", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { userId, areaId } = req.params;

    const performance = await Performance.findOne({ userId });
    if (!performance) {
      return res.status(404).json({
        success: false,
        message: "Performance record not found"
      });
    }

    // Remove improvement area
    performance.improvementAreas = performance.improvementAreas.filter(
      area => area._id.toString() !== areaId
    );

    await performance.save();

    res.status(200).json({
      success: true,
      message: "Improvement area removed successfully",
      remainingImprovementAreas: performance.improvementAreas.length
    });

  } catch (error) {
    console.error("Remove improvement area error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove improvement area"
    });
  }
});

// 🔹 GET /api/performance/rankings - Get performance rankings (admin only)
router.get("/rankings", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { month, year, department, limit = 50 } = req.query;

    // Default to current month if not provided
    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1).toString().padStart(2, '0');
    const targetYear = year || now.getFullYear().toString();
    const monthKey = `${targetYear}-${targetMonth}`;

    let query = { month: monthKey };
    let userIds = [];

    // Filter by department if specified
    if (department) {
      const departmentUsers = await UserProfile.find({ department }).select('userId');
      userIds = departmentUsers.map(u => u.userId);
      query.userId = { $in: userIds };
    }

    const rankings = await Performance.find(query)
      .populate('userId', 'username email')
      .sort({ overallScore: -1, performanceGrade: 1 })
      .limit(parseInt(limit));

    // Enrich with user profile data
    const enrichedRankings = [];
    for (const performance of rankings) {
      const profile = await UserProfile.findOne({ userId: performance.userId._id });
      
      enrichedRankings.push({
        rank: enrichedRankings.length + 1,
        userId: performance.userId._id,
        username: performance.userId.username,
        email: performance.userId.email,
        name: profile?.name || performance.userId.username,
        department: profile?.department,
        jobTitle: profile?.jobTitle,
        overallScore: performance.overallScore,
        performanceGrade: performance.performanceGrade,
        attendanceRate: performance.attendanceData.attendanceRate,
        taskCompletionRate: performance.taskData.taskCompletionRate,
        supervisorRating: performance.supervisorRating,
        achievementsCount: performance.achievements.length
      });
    }

    res.status(200).json({
      success: true,
      month: monthKey,
      department: department || 'All Departments',
      rankings: enrichedRankings,
      totalRanked: enrichedRankings.length
    });

  } catch (error) {
    console.error("Get rankings error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch performance rankings"
    });
  }
});

// 🔹 GET /api/performance/analytics - Get performance analytics (admin only)
router.get("/analytics", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { period = 'quarter', startMonth, endMonth } = req.query;

    let months = [];
    const now = new Date();

    if (startMonth && endMonth) {
      // Custom date range
      const start = new Date(startMonth + '-01');
      const end = new Date(endMonth + '-01');
      
      const current = new Date(start);
      while (current <= end) {
        const monthStr = `${current.getFullYear()}-${(current.getMonth() + 1).toString().padStart(2, '0')}`;
        months.push(monthStr);
        current.setMonth(current.getMonth() + 1);
      }
    } else {
      // Predefined periods
      let monthsBack = 3;
      switch (period) {
        case 'quarter':
          monthsBack = 3;
          break;
        case 'half-year':
          monthsBack = 6;
          break;
        case 'year':
          monthsBack = 12;
          break;
      }

      for (let i = monthsBack - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        months.push(monthStr);
      }
    }

    // Get performance data for all months
    const performanceData = await Performance.find({
      month: { $in: months }
    }).populate('userId', 'username email');

    // Analytics calculations
    const analytics = {
      period,
      months,
      trends: {
        overallScore: [],
        attendanceRate: [],
        taskCompletionRate: [],
        gradeDistribution: []
      },
      patterns: {
        topConsistentPerformers: [],
        improvingEmployees: [],
        decliningEmployees: [],
        departmentTrends: {}
      },
      insights: []
    };

    // Calculate monthly trends
    for (const month of months) {
      const monthData = performanceData.filter(p => p.month === month);
      
      if (monthData.length > 0) {
        const avgOverallScore = Math.round(
          monthData.reduce((sum, p) => sum + p.overallScore, 0) / monthData.length
        );
        const avgAttendanceRate = Math.round(
          monthData.reduce((sum, p) => sum + p.attendanceData.attendanceRate, 0) / monthData.length
        );
        const avgTaskCompletionRate = Math.round(
          monthData.reduce((sum, p) => sum + p.taskData.taskCompletionRate, 0) / monthData.length
        );

        const gradeCount = { A: 0, B: 0, C: 0, D: 0, F: 0 };
        monthData.forEach(p => gradeCount[p.performanceGrade]++);

        analytics.trends.overallScore.push({ month, score: avgOverallScore });
        analytics.trends.attendanceRate.push({ month, rate: avgAttendanceRate });
        analytics.trends.taskCompletionRate.push({ month, rate: avgTaskCompletionRate });
        analytics.trends.gradeDistribution.push({ month, ...gradeCount });
      }
    }

    // Find consistent top performers
    const userPerformanceMap = {};
    performanceData.forEach(p => {
      const userId = p.userId._id.toString();
      if (!userPerformanceMap[userId]) {
        userPerformanceMap[userId] = {
          userId: p.userId._id,
          username: p.userId.username,
          scores: [],
          averageScore: 0
        };
      }
      userPerformanceMap[userId].scores.push(p.overallScore);
    });

    // Calculate averages and find patterns
    Object.values(userPerformanceMap).forEach(user => {
      if (user.scores.length >= 2) {
        user.averageScore = Math.round(user.scores.reduce((sum, s) => sum + s, 0) / user.scores.length);
        user.consistency = user.scores.length >= 3 ? 
          Math.round(100 - (Math.max(...user.scores) - Math.min(...user.scores))) : 0;
        
        // Check for improvement/decline trends
        if (user.scores.length >= 3) {
          const firstHalf = user.scores.slice(0, Math.floor(user.scores.length / 2));
          const secondHalf = user.scores.slice(Math.floor(user.scores.length / 2));
          
          const firstAvg = firstHalf.reduce((sum, s) => sum + s, 0) / firstHalf.length;
          const secondAvg = secondHalf.reduce((sum, s) => sum + s, 0) / secondHalf.length;
          
          user.trend = secondAvg - firstAvg;
        }
      }
    });

    // Top consistent performers (high average + high consistency)
    analytics.patterns.topConsistentPerformers = Object.values(userPerformanceMap)
      .filter(u => u.averageScore >= 80 && u.consistency >= 80)
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 10);

    // Improving employees (positive trend)
    analytics.patterns.improvingEmployees = Object.values(userPerformanceMap)
      .filter(u => u.trend && u.trend > 5)
      .sort((a, b) => b.trend - a.trend)
      .slice(0, 10);

    // Declining employees (negative trend)
    analytics.patterns.decliningEmployees = Object.values(userPerformanceMap)
      .filter(u => u.trend && u.trend < -5)
      .sort((a, b) => a.trend - b.trend)
      .slice(0, 10);

    // Generate insights
    const latestMonth = months[months.length - 1];
    const latestData = performanceData.filter(p => p.month === latestMonth);
    
    if (latestData.length > 0) {
      const latestAvgScore = Math.round(
        latestData.reduce((sum, p) => sum + p.overallScore, 0) / latestData.length
      );
      
      analytics.insights.push(`Company average performance score for ${latestMonth}: ${latestAvgScore}`);
      
      const highPerformers = latestData.filter(p => p.overallScore >= 90).length;
      const lowPerformers = latestData.filter(p => p.overallScore < 60).length;
      
      analytics.insights.push(`${highPerformers} high performers (90+) and ${lowPerformers} need improvement (<60)`);
      
      if (analytics.trends.overallScore.length >= 2) {
        const trend = analytics.trends.overallScore[analytics.trends.overallScore.length - 1].score - 
                     analytics.trends.overallScore[analytics.trends.overallScore.length - 2].score;
        
        if (trend > 0) {
          analytics.insights.push(`Performance trending upward (+${trend} points from last month)`);
        } else if (trend < 0) {
          analytics.insights.push(`Performance trending downward (${trend} points from last month)`);
        } else {
          analytics.insights.push('Performance remained stable from last month');
        }
      }
    }

    res.status(200).json({
      success: true,
      analytics,
      dataPoints: performanceData.length
    });

  } catch (error) {
    console.error("Get performance analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch performance analytics"
    });
  }
});

// 🔹 POST /api/performance/export - Export performance data (admin only)
router.post("/export", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { month, year, department, format = 'json' } = req.body;

    // Default to current month if not provided
    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1).toString().padStart(2, '0');
    const targetYear = year || now.getFullYear().toString();
    const monthKey = `${targetYear}-${targetMonth}`;

    let query = { month: monthKey };

    // Filter by department if specified
    if (department) {
      const departmentUsers = await UserProfile.find({ department }).select('userId');
      const userIds = departmentUsers.map(u => u.userId);
      query.userId = { $in: userIds };
    }

    const performanceData = await Performance.find(query)
      .populate('userId', 'username email')
      .sort({ overallScore: -1 });

    // Enrich with user profile data
    const exportData = [];
    for (const performance of performanceData) {
      const profile = await UserProfile.findOne({ userId: performance.userId._id });
      
      exportData.push({
        month: performance.month,
        userId: performance.userId._id,
        username: performance.userId.username,
        email: performance.userId.email,
        name: profile?.name || performance.userId.username,
        department: profile?.department || 'N/A',
        jobTitle: profile?.jobTitle || 'N/A',
        overallScore: performance.overallScore,
        performanceGrade: performance.performanceGrade,
        attendanceRate: performance.attendanceData.attendanceRate,
        punctualityRate: performance.attendanceData.punctualityRate,
        totalWorkingHours: performance.attendanceData.totalWorkingHours,
        taskCompletionRate: performance.taskData.taskCompletionRate,
        averageTaskRating: performance.taskData.averageTaskRating,
        supervisorRating: performance.supervisorRating || 'N/A',
        achievementsCount: performance.achievements.length,
        improvementAreasCount: performance.improvementAreas.length,
        lastCalculated: performance.lastCalculated
      });
    }

    // Set appropriate headers for download
    const filename = `performance_report_${monthKey}${department ? `_${department}` : ''}.${format}`;
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // Convert to CSV
      if (exportData.length > 0) {
        const headers = Object.keys(exportData[0]).join(',');
        const csvData = exportData.map(row => 
          Object.values(row).map(value => 
            typeof value === 'string' && value.includes(',') ? `"${value}"` : value
          ).join(',')
        ).join('\n');
        
        res.send(headers + '\n' + csvData);
      } else {
        res.send('No data available for the specified criteria');
      }
    } else {
      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      res.json({
        success: true,
        exportInfo: {
          month: monthKey,
          department: department || 'All Departments',
          format,
          recordCount: exportData.length,
          exportedAt: new Date().toISOString()
        },
        data: exportData
      });
    }

  } catch (error) {
    console.error("Export performance data error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export performance data"
    });
  }
});

module.exports = router;