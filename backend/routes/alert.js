const express = require("express");
const router = express.Router();
const Alert = require("../models/alert");
const User = require("../models/user");
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

// 🔹 GET /api/alerts/my-alerts - Get current user's alerts
router.get("/my-alerts", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { isRead, type, priority } = req.query;

    // Build query
    let query = { 
      userId,
      expiresAt: { $gt: new Date() } // Only non-expired alerts
    };
    
    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }
    if (type) query.type = type;
    if (priority) query.priority = priority;

    const alerts = await Alert.find(query)
      .sort({ createdAt: -1 })
      .limit(50); // Limit to recent 50 alerts

    // Group alerts by priority for better organization
    const groupedAlerts = {
      urgent: alerts.filter(a => a.priority === 'urgent'),
      high: alerts.filter(a => a.priority === 'high'),
      medium: alerts.filter(a => a.priority === 'medium'),
      low: alerts.filter(a => a.priority === 'low')
    };

    const unreadCount = alerts.filter(a => !a.isRead).length;

    res.status(200).json({
      success: true,
      alerts,
      groupedAlerts,
      unreadCount,
      total: alerts.length
    });

  } catch (error) {
    console.error("Get my alerts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch alerts"
    });
  }
});

// 🔹 PUT /api/alerts/mark-read/:alertId - Mark alert as read
router.put("/mark-read/:alertId", authenticateToken, async (req, res) => {
  try {
    const { alertId } = req.params;
    const userId = req.user.id;

    const alert = await Alert.findById(alertId);
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found"
      });
    }

    // Check if alert belongs to user
    if (alert.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only mark your own alerts as read"
      });
    }

    alert.isRead = true;
    await alert.save();

    res.status(200).json({
      success: true,
      message: "Alert marked as read",
      alert
    });

  } catch (error) {
    console.error("Mark alert as read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark alert as read"
    });
  }
});

// 🔹 PUT /api/alerts/mark-all-read - Mark all user's alerts as read
router.put("/mark-all-read", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await Alert.updateMany(
      { 
        userId, 
        isRead: false,
        expiresAt: { $gt: new Date() }
      },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} alerts marked as read`
    });

  } catch (error) {
    console.error("Mark all alerts as read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark all alerts as read"
    });
  }
});

// 🔹 DELETE /api/alerts/delete/:alertId - Delete alert
router.delete("/delete/:alertId", authenticateToken, async (req, res) => {
  try {
    const { alertId } = req.params;
    const userId = req.user.id;

    const alert = await Alert.findById(alertId);
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found"
      });
    }

    // Check if alert belongs to user or user is admin
    if (alert.userId.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own alerts"
      });
    }

    await Alert.findByIdAndDelete(alertId);

    res.status(200).json({
      success: true,
      message: "Alert deleted successfully"
    });

  } catch (error) {
    console.error("Delete alert error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete alert"
    });
  }
});

// 🔹 POST /api/alerts/create - Create alert (admin only)
router.post("/create", authenticateToken, adminOnly, async (req, res) => {
  try {
    const {
      type,
      userId,
      title,
      message,
      priority,
      actionRequired,
      actionUrl,
      relatedId,
      relatedModel,
      expiresInDays
    } = req.body;

    // Validate input
    if (!type || !userId || !title || !message) {
      return res.status(400).json({
        success: false,
        message: "Required fields: type, userId, title, message"
      });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expiresInDays || 7)); // Default 7 days

    const newAlert = new Alert({
      type,
      userId,
      title: title.trim(),
      message: message.trim(),
      priority: priority || 'medium',
      actionRequired: actionRequired || false,
      actionUrl: actionUrl || null,
      relatedId: relatedId || null,
      relatedModel: relatedModel || null,
      expiresAt
    });

    await newAlert.save();

    res.status(201).json({
      success: true,
      message: "Alert created successfully",
      alert: newAlert
    });

  } catch (error) {
    console.error("Create alert error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create alert"
    });
  }
});

// 🔹 POST /api/alerts/broadcast - Broadcast alert to all users (admin only)
router.post("/broadcast", authenticateToken, adminOnly, async (req, res) => {
  try {
    const {
      type,
      title,
      message,
      priority,
      actionRequired,
      actionUrl,
      department, // Optional: broadcast to specific department only
      expiresInDays
    } = req.body;

    if (!type || !title || !message) {
      return res.status(400).json({
        success: false,
        message: "Required fields: type, title, message"
      });
    }

    // Get target users
    let targetUsers;
    if (department) {
      // Broadcast to specific department
      const UserProfile = require("../models/userprofile");
      const profiles = await UserProfile.find({ department })
        .populate('userId', '_id');
      targetUsers = profiles.map(p => p.userId._id);
    } else {
      // Broadcast to all users
      const users = await User.find({ role: 'user', verified: true })
        .select('_id');
      targetUsers = users.map(u => u._id);
    }

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expiresInDays || 7));

    // Create alerts for all target users
    const alertsToCreate = targetUsers.map(userId => ({
      type,
      userId,
      title: title.trim(),
      message: message.trim(),
      priority: priority || 'medium',
      actionRequired: actionRequired || false,
      actionUrl: actionUrl || null,
      expiresAt
    }));

    const createdAlerts = await Alert.insertMany(alertsToCreate);

    res.status(201).json({
      success: true,
      message: `Broadcast sent to ${createdAlerts.length} users`,
      alertsCreated: createdAlerts.length,
      targetDepartment: department || 'all'
    });

  } catch (error) {
    console.error("Broadcast alert error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to broadcast alert"
    });
  }
});

// 🔹 GET /api/alerts/admin/all - Get all alerts (admin only)
router.get("/admin/all", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      type, 
      priority, 
      isRead,
      userId 
    } = req.query;

    // Build query
    let query = {};
    if (type) query.type = type;
    if (priority) query.priority = priority;
    if (isRead !== undefined) query.isRead = isRead === 'true';
    if (userId) query.userId = userId;

    const alerts = await Alert.find(query)
      .populate('userId', 'username email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Alert.countDocuments(query);

    // Get statistics
    const stats = {
      total: await Alert.countDocuments(),
      unread: await Alert.countDocuments({ isRead: false }),
      urgent: await Alert.countDocuments({ priority: 'urgent' }),
      actionRequired: await Alert.countDocuments({ actionRequired: true }),
      expired: await Alert.countDocuments({ expiresAt: { $lte: new Date() } })
    };

    res.status(200).json({
      success: true,
      alerts,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      },
      stats,
      totalAlerts: total
    });

  } catch (error) {
    console.error("Get all alerts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch alerts"
    });
  }
});

// 🔹 GET /api/alerts/admin/statistics - Get alert statistics (admin only)
router.get("/admin/statistics", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    // Get date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(days));

    // Get statistics for the period
    const stats = {
      period: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        days: parseInt(days)
      },
      totals: {
        created: await Alert.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate }
        }),
        read: await Alert.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate },
          isRead: true
        }),
        unread: await Alert.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate },
          isRead: false
        }),
        expired: await Alert.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate },
          expiresAt: { $lte: new Date() }
        })
      },
      byType: {},
      byPriority: {},
      readRate: 0
    };

    // Get breakdown by type
    const typeBreakdown = await Alert.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          read: { $sum: { $cond: ["$isRead", 1, 0] } }
        }
      }
    ]);

    typeBreakdown.forEach(item => {
      stats.byType[item._id] = {
        total: item.count,
        read: item.read,
        unread: item.count - item.read
      };
    });

    // Get breakdown by priority
    const priorityBreakdown = await Alert.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 }
        }
      }
    ]);

    priorityBreakdown.forEach(item => {
      stats.byPriority[item._id] = item.count;
    });

    // Calculate read rate
    if (stats.totals.created > 0) {
      stats.readRate = Math.round((stats.totals.read / stats.totals.created) * 100);
    }

    res.status(200).json({
      success: true,
      stats
    });

  } catch (error) {
    console.error("Get alert statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch alert statistics"
    });
  }
});

// 🔹 DELETE /api/alerts/admin/cleanup-expired - Clean up expired alerts (admin only)
router.delete("/admin/cleanup-expired", authenticateToken, adminOnly, async (req, res) => {
  try {
    const result = await Alert.deleteMany({
      expiresAt: { $lte: new Date() }
    });

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} expired alerts cleaned up`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error("Cleanup expired alerts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cleanup expired alerts"
    });
  }
});

// 🔹 PUT /api/alerts/admin/bulk-action - Bulk action on alerts (admin only)
router.put("/admin/bulk-action", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { alertIds, action } = req.body; // action: 'mark-read', 'delete'

    if (!alertIds || !Array.isArray(alertIds) || !action) {
      return res.status(400).json({
        success: false,
        message: "alertIds array and action are required"
      });
    }

    let result = {};

    switch (action) {
      case 'mark-read':
        result = await Alert.updateMany(
          { _id: { $in: alertIds } },
          { isRead: true }
        );
        break;

      case 'delete':
        result = await Alert.deleteMany({
          _id: { $in: alertIds }
        });
        break;

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid action. Must be 'mark-read' or 'delete'"
        });
    }

    res.status(200).json({
      success: true,
      message: `Bulk ${action} completed`,
      affectedCount: result.modifiedCount || result.deletedCount || 0
    });

  } catch (error) {
    console.error("Bulk action error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to perform bulk action"
    });
  }
});

// 🔹 Helper function to create system alerts (can be called from other modules)
const createSystemAlert = async (type, userId, title, message, options = {}) => {
  try {
    const {
      priority = 'medium',
      actionRequired = false,
      actionUrl = null,
      relatedId = null,
      relatedModel = null,
      expiresInDays = 7
    } = options;

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const alert = new Alert({
      type,
      userId,
      title,
      message,
      priority,
      actionRequired,
      actionUrl,
      relatedId,
      relatedModel,
      expiresAt
    });

    await alert.save();
    return alert;

  } catch (error) {
    console.error("Create system alert error:", error);
    throw error;
  }
};

// 🔹 Helper function to create shift reminder alerts
const createShiftReminder = async (userId, scheduleId, shiftDate, shiftTime) => {
  return await createSystemAlert(
    'shift_reminder',
    userId,
    'Upcoming Shift Reminder',
    `You have a shift scheduled for ${shiftDate} at ${shiftTime}. Please be on time!`,
    {
      priority: 'medium',
      actionRequired: true,
      relatedId: scheduleId,
      relatedModel: 'Schedule',
      expiresInDays: 1
    }
  );
};

// 🔹 Helper function to create task assignment alerts
const createTaskAlert = async (userId, taskId, taskTitle, dueDate) => {
  return await createSystemAlert(
    'task_assigned',
    userId,
    'New Task Assigned',
    `You have been assigned a new task: "${taskTitle}". Due date: ${dueDate}`,
    {
      priority: 'high',
      actionRequired: true,
      relatedId: taskId,
      relatedModel: 'Task',
      expiresInDays: 3
    }
  );
};

// 🔹 Helper function to create swap request alerts
const createSwapRequestAlert = async (targetUserId, swapId, requesterName, shiftDate) => {
  return await createSystemAlert(
    'swap_request',
    targetUserId,
    'Shift Swap Request',
    `${requesterName} has requested to swap shifts with you for ${shiftDate}. Please review and respond.`,
    {
      priority: 'high',
      actionRequired: true,
      relatedId: swapId,
      relatedModel: 'ShiftSwap',
      expiresInDays: 2
    }
  );
};

// 🔹 Helper function to create emergency cleanup alerts
const createEmergencyAlert = async (userId, location, urgency = 'high') => {
  return await createSystemAlert(
    'emergency_cleanup',
    userId,
    'Emergency Cleanup Required',
    `Immediate attention required at ${location}. Please respond as soon as possible.`,
    {
      priority: urgency === 'critical' ? 'urgent' : 'high',
      actionRequired: true,
      expiresInDays: 1
    }
  );
};

// 🔹 Helper function to create attendance missing alerts
const createAttendanceMissingAlert = async (userId, date) => {
  return await createSystemAlert(
    'attendance_missing',
    userId,
    'Attendance Not Marked',
    `You haven't marked your attendance for ${date}. Please update your attendance status.`,
    {
      priority: 'medium',
      actionRequired: true,
      expiresInDays: 2
    }
  );
};

// Export helper functions for use in other modules
module.exports = router;
module.exports.createSystemAlert = createSystemAlert;
module.exports.createShiftReminder = createShiftReminder;
module.exports.createTaskAlert = createTaskAlert;
module.exports.createSwapRequestAlert = createSwapRequestAlert;
module.exports.createEmergencyAlert = createEmergencyAlert;
module.exports.createAttendanceMissingAlert = createAttendanceMissingAlert;