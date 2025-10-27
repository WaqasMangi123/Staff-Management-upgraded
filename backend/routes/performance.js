const express = require("express");
const router = express.Router();
const User = require("../models/user");
const UserProfile = require("../models/userprofile");
const Task = require("../models/task");
const Attendance = require("../models/attendance");
const Schedule = require("../models/schedule");
const Performance = require("../models/performance"); // Enhanced Performance model
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

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

// Email transporter setup
const createEmailTransporter = () => {
  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Helper function to send performance notification emails
const sendPerformanceNotificationEmail = async (user, subject, content, type = 'info') => {
  try {
    const transporter = createEmailTransporter();
    
    const emailTemplate = {
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${type === 'warning' ? '#dc3545' : type === 'success' ? '#28a745' : '#007bff'};">
            ${subject}
          </h2>
          <p>Dear ${user.username},</p>
          <div style="background-color: ${type === 'warning' ? '#f8d7da' : '#f8f9fa'}; 
                      border-left: 4px solid ${type === 'warning' ? '#dc3545' : '#007bff'}; 
                      padding: 15px; margin: 20px 0;">
            ${content}
          </div>
          <p>Please log into your dashboard for more details.</p>
          <hr>
          <p><em>This is an automated message from Performance Management System.</em></p>
        </div>
      `
    };

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

// Helper function to calculate performance metrics (EXISTING - UNCHANGED)
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

// Helper function to get date range (EXISTING - UNCHANGED)
const getDateRange = (month, year) => {
  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const lastDay = new Date(year, parseInt(month), 0).getDate();
  const endDate = `${year}-${month.padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
  return { startDate, endDate };
};

// Helper function to save/update performance record in database
const savePerformanceRecord = async (userId, month, metrics, calculatedBy = null) => {
  try {
    const monthString = month;
    
    // Check if performance record already exists
    let performanceRecord = await Performance.findOne({ userId, month: monthString });
    
    if (performanceRecord) {
      // Update existing record
      Object.assign(performanceRecord, metrics);
      performanceRecord.calculatedAt = new Date();
      performanceRecord.calculatedBy = calculatedBy;
    } else {
      // Create new record
      performanceRecord = new Performance({
        userId,
        month: monthString,
        ...metrics,
        calculatedAt: new Date(),
        calculatedBy
      });
    }

    // Calculate trends if there's a previous month
    const prevMonth = new Date();
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prevMonthString = `${prevMonth.getFullYear()}-${(prevMonth.getMonth() + 1).toString().padStart(2, '0')}`;
    
    const previousRecord = await Performance.findOne({ userId, month: prevMonthString });
    if (previousRecord) {
      performanceRecord.calculateTrends(previousRecord);
    }

    await performanceRecord.save();
    return performanceRecord;
  } catch (error) {
    console.error('Error saving performance record:', error);
    throw error;
  }
};

// Enhanced helper function to check and create automatic warnings
const checkAndCreateAutoWarnings = async (userId, month, performanceMetrics, createdBy = null) => {
  try {
    const overallScore = Math.round(
      (performanceMetrics.attendanceScore * 0.4) + 
      (performanceMetrics.taskCompletionRate * 0.4) + 
      (performanceMetrics.punctualityScore * 0.2)
    );

    const needsWarning = 
      overallScore < 60 || // Overall poor performance
      performanceMetrics.attendanceScore < 70 || // Poor attendance
      performanceMetrics.taskCompletionRate < 70; // Poor task completion

    if (needsWarning) {
      // Get existing performance record
      let performanceRecord = await Performance.findOne({ userId, month });
      
      if (performanceRecord) {
        // Check current warning level
        const currentWarnings = performanceRecord.warningsCount || 0;
        let warningLevel = 'first_warning';
        
        if (currentWarnings >= 2) {
          warningLevel = 'final_warning';
        } else if (currentWarnings >= 1) {
          warningLevel = 'second_warning';
        }

        // Determine warning reason
        let warningReason = 'Overall performance below standards';
        if (overallScore < 60) {
          warningReason = `Overall performance critically low: ${overallScore}%`;
        } else if (performanceMetrics.attendanceScore < 70) {
          warningReason = `Attendance below acceptable level: ${performanceMetrics.attendanceScore}%`;
        } else if (performanceMetrics.taskCompletionRate < 70) {
          warningReason = `Task completion rate too low: ${performanceMetrics.taskCompletionRate}%`;
        }

        // Add disciplinary action
        await performanceRecord.addDisciplinaryAction(
          'verbal_warning',
          warningReason,
          `Automatic warning generated due to poor performance in ${month}. Immediate improvement required.`,
          createdBy
        );

        // Send email notification
        const user = await User.findById(userId).select('username email');
        if (user) {
          await sendPerformanceNotificationEmail(
            user,
            `Performance Warning - ${warningLevel.replace('_', ' ').toUpperCase()}`,
            `<p>Your performance for ${month} requires immediate attention:</p>
             <ul>
               <li>Overall Score: ${overallScore}%</li>
               <li>Attendance: ${performanceMetrics.attendanceScore}%</li>
               <li>Task Completion: ${performanceMetrics.taskCompletionRate}%</li>
               <li>Punctuality: ${performanceMetrics.punctualityScore}%</li>
             </ul>
             <p><strong>Action Required:</strong> Please schedule a meeting with your supervisor to discuss performance improvement strategies.</p>`,
            'warning'
          );
        }

        return {
          warningCreated: true,
          warningLevel,
          reason: warningReason,
          overallScore
        };
      }
    }

    return {
      warningCreated: false,
      overallScore
    };
  } catch (error) {
    console.error('Error checking auto warnings:', error);
    return { warningCreated: false, error: error.message };
  }
};

// ================== EXISTING ROUTES (UNCHANGED) ==================

// GET /api/performance/my-performance - Get current user's performance (EXISTING - UNCHANGED)
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

    // Get or create performance record
    const monthString = `${targetYear}-${targetMonth}`;
    await savePerformanceRecord(userId, monthString, performance);

    // Get saved performance record with enhanced data
    const performanceRecord = await Performance.findOne({ userId, month: monthString });

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
        calculatedAt: new Date(),
        // Enhanced data from Performance model
        hasActiveWarnings: performanceRecord?.hasActiveWarnings || false,
        warningLevel: performanceRecord?.warningLevel || 'none',
        performanceLevel: performanceRecord?.performanceLevel || 'poor',
        grade: performanceRecord?.grade || 'F',
        overallScore: performanceRecord?.overallScore || 0,
        activeIssuesCount: performanceRecord?.activeIssuesCount || 0,
        goalsCompletionRate: performanceRecord?.goalsCompletionRate || 0
      },
      performanceHistory: performanceHistory.sort((a, b) => b.month.localeCompare(a.month)),
      userInfo: {
        username: user?.username || 'Unknown',
        email: user?.email || 'Unknown',
        name: profile?.name || user?.username || 'Unknown',
        department: profile?.department || 'Not Set',
        jobTitle: profile?.jobTitle || 'Not Set'
      },
      // Additional enhanced info
      alerts: performanceRecord?.alerts || {},
      achievements: performanceRecord?.achievements || [],
      goals: performanceRecord?.goals || [],
      recognitions: performanceRecord?.recognitions || []
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

// GET /api/performance/admin/all-users - Get all users performance (EXISTING - ENHANCED)
router.get("/admin/all-users", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { month, year, department, limit = 50, performanceLevel, warningLevel } = req.query;

    // Default to current month
    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1).toString().padStart(2, '0');
    const targetYear = year || now.getFullYear().toString();

    console.log(`Admin getting all performance for month ${targetYear}-${targetMonth}`);

    // Get date range
    const { startDate, endDate } = getDateRange(targetMonth, targetYear);
    const monthString = `${targetYear}-${targetMonth}`;

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
        
        // Save/update performance record
        await savePerformanceRecord(user._id, monthString, performance, req.user.id);
        
        // Get enhanced performance record
        const performanceRecord = await Performance.findOne({ userId: user._id, month: monthString });

        // Apply filters
        if (performanceLevel && performanceRecord?.performanceLevel !== performanceLevel) {
          return null;
        }
        if (warningLevel && warningLevel !== 'none' && performanceRecord?.warningLevel !== warningLevel) {
          return null;
        }
        if (warningLevel === 'none' && performanceRecord?.warningLevel !== 'none') {
          return null;
        }

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
          calculatedAt: new Date(),
          // Enhanced fields
          hasActiveWarnings: performanceRecord?.hasActiveWarnings || false,
          warningLevel: performanceRecord?.warningLevel || 'none',
          warningsCount: performanceRecord?.warningsCount || 0,
          performanceLevel: performanceRecord?.performanceLevel || 'poor',
          grade: performanceRecord?.grade || 'F',
          overallScore: performanceRecord?.overallScore || 0,
          riskLevel: performanceRecord?.riskLevel || 'none',
          activeIssuesCount: performanceRecord?.activeIssuesCount || 0,
          status: performanceRecord?.status || 'draft'
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
        department: department || 'all',
        excellentPerformers: allPerformance.filter(p => p.performanceLevel === 'excellent').length,
        goodPerformers: allPerformance.filter(p => p.performanceLevel === 'good').length,
        needsAttention: allPerformance.filter(p => p.hasActiveWarnings || p.performanceLevel === 'poor').length,
        highRisk: allPerformance.filter(p => p.riskLevel === 'high').length
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

// GET /api/performance/admin/user/:userId - Get specific user performance (EXISTING - ENHANCED)
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
    const monthString = `${targetYear}-${targetMonth}`;

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
    
    // Save/update performance record
    await savePerformanceRecord(userId, monthString, performance, req.user.id);
    
    // Get enhanced performance record
    const performanceRecord = await Performance.findOne({ userId, month: monthString })
      .populate('disciplinaryActions.issuedBy', 'username')
      .populate('achievements.addedBy', 'username')
      .populate('areas_for_improvement.addedBy', 'username');

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
        calculatedAt: new Date(),
        // Enhanced data
        hasActiveWarnings: performanceRecord?.hasActiveWarnings || false,
        warningLevel: performanceRecord?.warningLevel || 'none',
        warningsCount: performanceRecord?.warningsCount || 0,
        performanceLevel: performanceRecord?.performanceLevel || 'poor',
        grade: performanceRecord?.grade || 'F',
        overallScore: performanceRecord?.overallScore || 0,
        riskLevel: performanceRecord?.riskLevel || 'none',
        activeIssuesCount: performanceRecord?.activeIssuesCount || 0,
        goalsCompletionRate: performanceRecord?.goalsCompletionRate || 0,
        status: performanceRecord?.status || 'draft'
      },
      performanceHistory: performanceHistory.sort((a, b) => b.month.localeCompare(a.month)),
      userInfo: {
        username: user.username,
        email: user.email,
        name: profile?.name || user.username,
        department: profile?.department || 'Not Set',
        jobTitle: profile?.jobTitle || 'Not Set'
      },
      // Enhanced detailed information
      alerts: performanceRecord?.alerts || {},
      disciplinaryActions: performanceRecord?.disciplinaryActions || [],
      achievements: performanceRecord?.achievements || [],
      areas_for_improvement: performanceRecord?.areas_for_improvement || [],
      goals: performanceRecord?.goals || [],
      recognitions: performanceRecord?.recognitions || [],
      performanceIssues: performanceRecord?.performanceIssues || [],
      improvementPlan: performanceRecord?.improvementPlan || null,
      trend: performanceRecord?.trend || {},
      previousMonthComparison: performanceRecord?.previousMonthComparison || {}
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

// GET /api/performance/departments - Get department-wise performance summary (EXISTING - ENHANCED)
router.get("/departments", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { month, year } = req.query;

    // Default to current month
    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1).toString().padStart(2, '0');
    const targetYear = year || now.getFullYear().toString();
    const monthString = `${targetYear}-${targetMonth}`;

    // Get department averages using the enhanced model
    const departments = await Performance.getDepartmentAverages(monthString);

    res.status(200).json({
      success: true,
      month: monthString,
      departments
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

// GET /api/performance/debug/:userId - Debug specific user data (EXISTING - UNCHANGED)
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

    // Get performance record
    const monthString = `${targetYear}-${targetMonth}`;
    const performanceRecord = await Performance.findOne({ userId, month: monthString });

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
        })),
        performanceRecord: performanceRecord ? {
          overallScore: performanceRecord.overallScore,
          grade: performanceRecord.grade,
          performanceLevel: performanceRecord.performanceLevel,
          warningLevel: performanceRecord.warningLevel,
          hasActiveWarnings: performanceRecord.hasActiveWarnings,
          warningsCount: performanceRecord.warningsCount,
          status: performanceRecord.status,
          alerts: performanceRecord.alerts
        } : null
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

// POST /api/performance/admin/recalculate - Force recalculate performance (EXISTING - ENHANCED)
router.post("/admin/recalculate", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { month, year, userId, autoWarnings = false } = req.body;

    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1).toString().padStart(2, '0');
    const targetYear = year || now.getFullYear().toString();
    const monthString = `${targetYear}-${targetMonth}`;

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
        
        // Save performance record
        await savePerformanceRecord(user._id, monthString, performance, req.user.id);
        
        // Check for auto warnings if enabled
        let warningResult = null;
        if (autoWarnings) {
          warningResult = await checkAndCreateAutoWarnings(user._id, monthString, performance, req.user.id);
        }

        results.push({
          userId: user._id,
          username: user.username,
          performance,
          warningResult,
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
      month: monthString,
      dateRange: { startDate, endDate },
      warningsCreated: autoWarnings ? results.filter(r => r.warningResult?.warningCreated).length : 0
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

// ================== NEW ENHANCED ROUTES ==================

// GET /api/performance/admin/analytics - Get performance analytics dashboard
router.get("/admin/analytics", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { month, year } = req.query;
    
    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1).toString().padStart(2, '0');
    const targetYear = year || now.getFullYear().toString();
    const monthString = `${targetYear}-${targetMonth}`;

    const analytics = await Performance.getPerformanceAnalytics(monthString);
    const lowPerformers = await Performance.getLowPerformers(monthString);
    const needingAttention = await Performance.getEmployeesNeedingAttention(monthString);

    res.json({
      success: true,
      month: monthString,
      analytics,
      lowPerformers,
      employeesNeedingAttention: needingAttention,
      summary: {
        totalLowPerformers: lowPerformers.length,
        employeesNeedingAttention: needingAttention.length,
        criticalCases: needingAttention.filter(emp => emp.riskLevel === 'high').length
      }
    });

  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get performance analytics",
      error: error.message
    });
  }
});

// POST /api/performance/admin/add-achievement - Add achievement to user
router.post("/admin/add-achievement", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { userId, month, title, description, category, points } = req.body;

    if (!userId || !month || !title) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: userId, month, title"
      });
    }

    const performanceRecord = await Performance.findOne({ userId, month });
    if (!performanceRecord) {
      return res.status(404).json({
        success: false,
        message: "Performance record not found for this user and month"
      });
    }

    await performanceRecord.addAchievement(title, description, category, points, req.user.id);

    // Send notification email
    const user = await User.findById(userId).select('username email');
    if (user) {
      await sendPerformanceNotificationEmail(
        user,
        'Achievement Recognition',
        `<p>Congratulations! You have been recognized for:</p>
         <h3>${title}</h3>
         <p>${description}</p>
         <p><strong>Category:</strong> ${category || 'Performance'}</p>
         ${points > 0 ? `<p><strong>Points Awarded:</strong> ${points}</p>` : ''}`,
        'success'
      );
    }

    res.json({
      success: true,
      message: "Achievement added successfully",
      achievement: performanceRecord.achievements[performanceRecord.achievements.length - 1]
    });

  } catch (error) {
    console.error("Add achievement error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add achievement",
      error: error.message
    });
  }
});

// POST /api/performance/admin/add-improvement-area - Add improvement area
router.post("/admin/add-improvement-area", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { userId, month, area, description, priority, targetDate } = req.body;

    if (!userId || !month || !area) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: userId, month, area"
      });
    }

    const performanceRecord = await Performance.findOne({ userId, month });
    if (!performanceRecord) {
      return res.status(404).json({
        success: false,
        message: "Performance record not found for this user and month"
      });
    }

    await performanceRecord.addImprovementArea(area, description, priority, targetDate, req.user.id);

    res.json({
      success: true,
      message: "Improvement area added successfully",
      improvementArea: performanceRecord.areas_for_improvement[performanceRecord.areas_for_improvement.length - 1]
    });

  } catch (error) {
    console.error("Add improvement area error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add improvement area",
      error: error.message
    });
  }
});

// POST /api/performance/admin/add-performance-issue - Add performance issue
router.post("/admin/add-performance-issue", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { userId, month, category, description, severity } = req.body;

    if (!userId || !month || !category || !description) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: userId, month, category, description"
      });
    }

    const performanceRecord = await Performance.findOne({ userId, month });
    if (!performanceRecord) {
      return res.status(404).json({
        success: false,
        message: "Performance record not found for this user and month"
      });
    }

    await performanceRecord.addPerformanceIssue(category, description, severity, req.user.id);

    // Send notification email
    const user = await User.findById(userId).select('username email');
    if (user) {
      await sendPerformanceNotificationEmail(
        user,
        'Performance Issue Reported',
        `<p>A performance issue has been reported:</p>
         <p><strong>Category:</strong> ${category.replace('_', ' ').toUpperCase()}</p>
         <p><strong>Severity:</strong> ${severity || 'Moderate'}</p>
         <p><strong>Description:</strong> ${description}</p>
         <p>Please contact your supervisor to discuss this matter.</p>`,
        'warning'
      );
    }

    res.json({
      success: true,
      message: "Performance issue added successfully",
      issue: performanceRecord.performanceIssues[performanceRecord.performanceIssues.length - 1]
    });

  } catch (error) {
    console.error("Add performance issue error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add performance issue",
      error: error.message
    });
  }
});

// POST /api/performance/admin/create-warning - Create disciplinary warning
router.post("/admin/create-warning", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { userId, month, type, reason, description, expiryDate } = req.body;

    if (!userId || !month || !type || !reason) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: userId, month, type, reason"
      });
    }

    const performanceRecord = await Performance.findOne({ userId, month });
    if (!performanceRecord) {
      return res.status(404).json({
        success: false,
        message: "Performance record not found for this user and month"
      });
    }

    await performanceRecord.addDisciplinaryAction(
      type,
      reason,
      description,
      req.user.id,
      expiryDate ? new Date(expiryDate) : null
    );

    // Send notification email
    const user = await User.findById(userId).select('username email');
    if (user) {
      await sendPerformanceNotificationEmail(
        user,
        `Disciplinary Action - ${type.replace('_', ' ').toUpperCase()}`,
        `<p>A disciplinary action has been taken:</p>
         <p><strong>Type:</strong> ${type.replace('_', ' ').toUpperCase()}</p>
         <p><strong>Reason:</strong> ${reason}</p>
         ${description ? `<p><strong>Details:</strong> ${description}</p>` : ''}
         ${expiryDate ? `<p><strong>Expires:</strong> ${new Date(expiryDate).toLocaleDateString()}</p>` : ''}
         <p>Please acknowledge this action by logging into your dashboard.</p>`,
        'warning'
      );
    }

    res.json({
      success: true,
      message: "Disciplinary action created successfully",
      action: performanceRecord.disciplinaryActions[performanceRecord.disciplinaryActions.length - 1]
    });

  } catch (error) {
    console.error("Create warning error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create disciplinary action",
      error: error.message
    });
  }
});

// POST /api/performance/admin/create-improvement-plan - Create improvement plan
router.post("/admin/create-improvement-plan", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { userId, month, objectives, duration } = req.body;

    if (!userId || !month || !objectives || !Array.isArray(objectives) || objectives.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: userId, month, objectives (array)"
      });
    }

    const performanceRecord = await Performance.findOne({ userId, month });
    if (!performanceRecord) {
      return res.status(404).json({
        success: false,
        message: "Performance record not found for this user and month"
      });
    }

    await performanceRecord.createImprovementPlan(objectives, duration, req.user.id);

    // Send notification email
    const user = await User.findById(userId).select('username email');
    if (user) {
      await sendPerformanceNotificationEmail(
        user,
        'Performance Improvement Plan Created',
        `<p>A Performance Improvement Plan has been created for you:</p>
         <p><strong>Duration:</strong> ${duration || 3} months</p>
         <p><strong>Objectives:</strong></p>
         <ul>
           ${objectives.map(obj => `<li>${obj.description} ${obj.targetDate ? `(Target: ${new Date(obj.targetDate).toLocaleDateString()})` : ''}</li>`).join('')}
         </ul>
         <p>Please schedule a meeting with your supervisor to discuss the plan details.</p>`,
        'warning'
      );
    }

    res.json({
      success: true,
      message: "Improvement plan created successfully",
      plan: performanceRecord.improvementPlan
    });

  } catch (error) {
    console.error("Create improvement plan error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create improvement plan",
      error: error.message
    });
  }
});

// POST /api/performance/admin/auto-check-warnings - Auto check and create warnings
router.post("/admin/auto-check-warnings", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { month, year, dryRun = false, emailNotifications = true } = req.body;
    
    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1).toString().padStart(2, '0');
    const targetYear = year || now.getFullYear().toString();
    const monthString = `${targetYear}-${targetMonth}`;

    // Get all performance records for the month
    const performanceRecords = await Performance.find({ 
      month: monthString,
      status: { $in: ['finalized', 'reviewed'] }
    }).populate('userId', 'username email');

    const results = [];

    for (const record of performanceRecords) {
      try {
        const overallScore = record.overallScore || 0;
        const needsWarning = 
          overallScore < 60 || // Overall poor performance
          record.attendanceScore < 70 || // Poor attendance
          record.taskCompletionRate < 70; // Poor task completion

        if (needsWarning && !dryRun) {
          // Check current warning level
          const currentWarnings = record.warningsCount || 0;
          let warningLevel = 'first_warning';
          
          if (currentWarnings >= 2) {
            warningLevel = 'final_warning';
          } else if (currentWarnings >= 1) {
            warningLevel = 'second_warning';
          }

          // Determine warning reason
          let warningReason = 'Overall performance below standards';
          if (overallScore < 60) {
            warningReason = `Overall performance critically low: ${overallScore}%`;
          } else if (record.attendanceScore < 70) {
            warningReason = `Attendance below acceptable level: ${record.attendanceScore}%`;
          } else if (record.taskCompletionRate < 70) {
            warningReason = `Task completion rate too low: ${record.taskCompletionRate}%`;
          }

          // Add disciplinary action
          await record.addDisciplinaryAction(
            'verbal_warning',
            warningReason,
            `Automatic warning generated due to poor performance in ${monthString}. Immediate improvement required.`,
            req.user.id
          );

          // Send email if enabled
          if (emailNotifications && record.userId) {
            await sendPerformanceNotificationEmail(
              record.userId,
              `Performance Warning - ${warningLevel.replace('_', ' ').toUpperCase()}`,
              `<p>Your performance for ${monthString} requires immediate attention:</p>
               <ul>
                 <li>Overall Score: ${overallScore}%</li>
                 <li>Attendance: ${record.attendanceScore}%</li>
                 <li>Task Completion: ${record.taskCompletionRate}%</li>
                 <li>Punctuality: ${record.punctualityScore}%</li>
               </ul>
               <p><strong>Action Required:</strong> Please schedule a meeting with your supervisor to discuss performance improvement strategies.</p>`,
              'warning'
            );
          }

          results.push({
            userId: record.userId._id,
            username: record.userId.username,
            overallScore,
            warningLevel,
            reason: warningReason,
            action: 'warning_created'
          });
        } else {
          results.push({
            userId: record.userId._id,
            username: record.userId.username,
            overallScore,
            needsWarning,
            action: needsWarning ? (dryRun ? 'would_warn' : 'no_action') : 'no_action'
          });
        }
      } catch (error) {
        results.push({
          userId: record.userId._id,
          username: record.userId.username,
          error: error.message,
          action: 'error'
        });
      }
    }

    res.json({
      success: true,
      message: `Auto-check completed. ${results.filter(r => r.action === 'warning_created').length} warnings ${dryRun ? 'would be created' : 'created'}`,
      results,
      summary: {
        total: results.length,
        warningsNeeded: results.filter(r => r.needsWarning).length,
        warningsCreated: dryRun ? 0 : results.filter(r => r.action === 'warning_created').length,
        errors: results.filter(r => r.action === 'error').length
      }
    });

  } catch (error) {
    console.error("Auto-check warnings error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to auto-check warnings",
      error: error.message
    });
  }
});

// GET /api/performance/admin/employees-needing-attention - Get employees needing attention
router.get("/admin/employees-needing-attention", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { month, year } = req.query;
    
    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1).toString().padStart(2, '0');
    const targetYear = year || now.getFullYear().toString();
    const monthString = `${targetYear}-${targetMonth}`;

    const employeesNeedingAttention = await Performance.getEmployeesNeedingAttention(monthString);

    res.json({
      success: true,
      month: monthString,
      employees: employeesNeedingAttention,
      summary: {
        total: employeesNeedingAttention.length,
        highRisk: employeesNeedingAttention.filter(emp => emp.riskLevel === 'high').length,
        mediumRisk: employeesNeedingAttention.filter(emp => emp.riskLevel === 'medium').length,
        withActiveWarnings: employeesNeedingAttention.filter(emp => emp.hasActiveWarnings).length,
        poorPerformance: employeesNeedingAttention.filter(emp => emp.overallScore < 60).length
      }
    });

  } catch (error) {
    console.error("Employees needing attention error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get employees needing attention",
      error: error.message
    });
  }
});

// GET /api/performance/user/my-warnings - Get current user's warnings and disciplinary actions
router.get("/user/my-warnings", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { month, year } = req.query;

    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1).toString().padStart(2, '0');
    const targetYear = year || now.getFullYear().toString();
    const monthString = `${targetYear}-${targetMonth}`;

    const performanceRecord = await Performance.findOne({ userId, month: monthString })
      .populate('disciplinaryActions.issuedBy', 'username');

    const response = {
      success: true,
      month: monthString,
      hasActiveWarnings: performanceRecord?.hasActiveWarnings || false,
      warningLevel: performanceRecord?.warningLevel || 'none',
      warningsCount: performanceRecord?.warningsCount || 0,
      disciplinaryActions: performanceRecord?.disciplinaryActions || [],
      performanceIssues: performanceRecord?.performanceIssues?.filter(issue => !issue.resolved) || [],
      improvementPlan: performanceRecord?.improvementPlan || null,
      alerts: performanceRecord?.alerts || {},
      riskLevel: performanceRecord?.riskLevel || 'none'
    };

    res.json(response);

  } catch (error) {
    console.error("Get user warnings error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get warnings",
      error: error.message
    });
  }
});

// POST /api/performance/user/acknowledge-warning - Acknowledge disciplinary action
router.post("/user/acknowledge-warning", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { month, warningId, comments } = req.body;

    if (!month || !warningId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: month, warningId"
      });
    }

    const performanceRecord = await Performance.findOne({ userId, month });
    if (!performanceRecord) {
      return res.status(404).json({
        success: false,
        message: "Performance record not found"
      });
    }

    const warning = performanceRecord.disciplinaryActions.id(warningId);
    if (!warning) {
      return res.status(404).json({
        success: false,
        message: "Warning not found"
      });
    }

    warning.acknowledgedByEmployee = true;
    warning.acknowledgedAt = new Date();
    if (comments) {
      warning.employeeComments = comments;
    }

    await performanceRecord.save();

    res.json({
      success: true,
      message: "Warning acknowledged successfully"
    });

  } catch (error) {
    console.error("Acknowledge warning error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to acknowledge warning",
      error: error.message
    });
  }
});

// Test route (EXISTING - UPDATED)
router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Enhanced Performance routes are working!",
    timestamp: new Date().toISOString(),
    availableRoutes: [
      // Existing routes
      'GET /my-performance',
      'GET /admin/all-users', 
      'GET /admin/user/:userId',
      'GET /departments',
      'GET /debug/:userId',
      'POST /admin/recalculate',
      
      // New enhanced routes
      'GET /admin/analytics',
      'GET /admin/employees-needing-attention',
      'POST /admin/add-achievement',
      'POST /admin/add-improvement-area',
      'POST /admin/add-performance-issue',
      'POST /admin/create-warning',
      'POST /admin/create-improvement-plan',
      'POST /admin/auto-check-warnings',
      'GET /user/my-warnings',
      'POST /user/acknowledge-warning'
    ]
  });
});

module.exports = router;