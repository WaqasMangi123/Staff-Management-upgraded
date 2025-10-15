const express = require("express");
const router = express.Router();
const Task = require("../models/task");
const User = require("../models/user");
const UserProfile = require("../models/userprofile");
const jwt = require("jsonwebtoken");

// Auto-reassignment service (inline for simplicity - you can move to separate file)
class AutoReassignmentService {
  /**
   * Find available users for a specific category and date
   */
  async findAvailableUsers(category, date, excludeUserId = null) {
    try {
      // Get all users with profiles matching the category
      const userProfiles = await UserProfile.find({
        jobTitle: { $regex: new RegExp(category, 'i') },
        isActive: true
      }).populate('userId', 'username email isActive');

      const availableUsers = [];

      for (const profile of userProfiles) {
        const user = profile.userId;
        
        if (!user || !user.isActive || user._id.toString() === excludeUserId) {
          continue;
        }

        // Check if user is present (you can implement actual attendance check here)
        const isPresent = await this.checkUserPresence(user._id, date);
        if (!isPresent) {
          continue;
        }

        // Check user's current workload for the date
        const currentTasks = await Task.countDocuments({
          assignedTo: user._id,
          date: date,
          status: { $in: ['pending', 'in-progress'] }
        });

        const totalEstimatedTime = await Task.aggregate([
          {
            $match: {
              assignedTo: user._id,
              date: date,
              status: { $in: ['pending', 'in-progress'] }
            }
          },
          {
            $group: {
              _id: null,
              totalTime: { $sum: '$estimatedDuration' }
            }
          }
        ]);

        const totalTime = totalEstimatedTime.length > 0 ? totalEstimatedTime[0].totalTime : 0;

        availableUsers.push({
          user: user,
          profile: profile,
          workloadScore: currentTasks,
          totalEstimatedTime: totalTime,
          currentTasks: currentTasks
        });
      }

      return availableUsers.sort((a, b) => a.workloadScore - b.workloadScore);
      
    } catch (error) {
      console.error('Error finding available users:', error);
      throw error;
    }
  }

  /**
   * Check if a user is present (implement your attendance logic here)
   */
  async checkUserPresence(userId, date) {
    try {
      // PLACEHOLDER: Replace with your actual attendance system
      // Example: Check if user has marked attendance for the day
      // const attendance = await Attendance.findOne({
      //   userId: userId,
      //   date: date,
      //   status: 'present'
      // });
      // return !!attendance;

      // For now, assume users are present unless you have attendance data
      return true;
    } catch (error) {
      console.error('Error checking user presence:', error);
      return false;
    }
  }

  /**
   * Auto-reassign a task when original assignee is absent
   */
  async autoReassignTask(taskId, reason = 'user_absent') {
    try {
      const task = await Task.findById(taskId).populate('assignedTo', 'username email');
      
      if (!task) {
        throw new Error('Task not found');
      }

      if (task.status !== 'pending') {
        throw new Error('Can only reassign pending tasks');
      }

      const availableUsers = await this.findAvailableUsers(
        task.category, 
        task.date, 
        task.assignedTo._id.toString()
      );

      if (availableUsers.length === 0) {
        return {
          success: false,
          message: 'No available users found for reassignment',
          task: task
        };
      }

      const selectedUser = availableUsers[0];
      const originalAssignee = task.assignedTo;

      // Update task with reassignment details
      task.originalAssignee = task.assignedTo;
      task.assignedTo = selectedUser.user._id;
      task.isReassigned = true;
      task.reassignmentReason = reason;
      task.reassignedAt = new Date();
      task.status = 'reassigned';

      // Add to reassignment history
      task.reassignmentHistory.push({
        fromUser: originalAssignee._id,
        toUser: selectedUser.user._id,
        reason: reason,
        timestamp: new Date()
      });

      await task.save();

      await task.populate([
        { path: 'assignedTo', select: 'username email' },
        { path: 'originalAssignee', select: 'username email' }
      ]);

      return {
        success: true,
        message: `Task reassigned from ${originalAssignee.username} to ${selectedUser.user.username}`,
        task: task,
        reassignmentDetails: {
          from: originalAssignee,
          to: selectedUser.user,
          reason: reason,
          newUserWorkload: selectedUser.currentTasks + 1
        }
      };

    } catch (error) {
      console.error('Auto-reassignment error:', error);
      throw error;
    }
  }

  /**
   * Check and auto-reassign tasks for absent users on a specific date
   */
  async checkAndReassignForDate(date) {
    try {
      const pendingTasks = await Task.find({
        date: date,
        status: 'pending',
        isReassigned: false
      }).populate('assignedTo', 'username email');

      const reassignmentResults = [];

      for (const task of pendingTasks) {
        const isPresent = await this.checkUserPresence(task.assignedTo._id, date);
        
        if (!isPresent) {
          console.log(`User ${task.assignedTo.username} is absent for task ${task.title} on ${date}`);
          
          try {
            const result = await this.autoReassignTask(task._id, 'user_absent');
            reassignmentResults.push(result);
          } catch (error) {
            reassignmentResults.push({
              success: false,
              message: `Failed to reassign task ${task.title}: ${error.message}`,
              task: task
            });
          }
        }
      }

      return reassignmentResults;
    } catch (error) {
      console.error('Error in checkAndReassignForDate:', error);
      throw error;
    }
  }

  /**
   * Get reassignment statistics
   */
  async getReassignmentStats(date = null) {
    try {
      let query = { isReassigned: true };
      if (date) {
        query.date = date;
      }

      const reassignedTasks = await Task.find(query)
        .populate('assignedTo', 'username email')
        .populate('originalAssignee', 'username email');

      const stats = {
        total: reassignedTasks.length,
        byReason: {},
        byCategory: {},
        byDate: {}
      };

      reassignedTasks.forEach(task => {
        const reason = task.reassignmentReason || 'unknown';
        stats.byReason[reason] = (stats.byReason[reason] || 0) + 1;

        stats.byCategory[task.category] = (stats.byCategory[task.category] || 0) + 1;

        stats.byDate[task.date] = (stats.byDate[task.date] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error getting reassignment stats:', error);
      throw error;
    }
  }

  /**
   * Manually reassign a task to a specific user
   */
  async manualReassignTask(taskId, newUserId, reason = 'manual_override') {
    try {
      const task = await Task.findById(taskId).populate('assignedTo', 'username email');
      const newUser = await User.findById(newUserId).select('username email');

      if (!task || !newUser) {
        throw new Error('Task or user not found');
      }

      if (task.assignedTo._id.toString() === newUserId) {
        throw new Error('Task is already assigned to this user');
      }

      const originalAssignee = task.assignedTo;

      if (!task.isReassigned) {
        task.originalAssignee = task.assignedTo;
      }
      
      task.assignedTo = newUserId;
      task.isReassigned = true;
      task.reassignmentReason = reason;
      task.reassignedAt = new Date();

      task.reassignmentHistory.push({
        fromUser: originalAssignee._id,
        toUser: newUserId,
        reason: reason,
        timestamp: new Date()
      });

      await task.save();

      await task.populate([
        { path: 'assignedTo', select: 'username email' },
        { path: 'originalAssignee', select: 'username email' }
      ]);

      return {
        success: true,
        message: `Task manually reassigned from ${originalAssignee.username} to ${newUser.username}`,
        task: task
      };

    } catch (error) {
      console.error('Manual reassignment error:', error);
      throw error;
    }
  }
}

// Create service instance
const autoReassignmentService = new AutoReassignmentService();

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
  console.log('🔍 Admin check - req.user:', req.user);
  
  if (req.user.tokenId) {
    console.log('✅ Admin token detected with tokenId:', req.user.tokenId);
    return next();
  }
  
  if (req.user.role === 'admin' || req.user.role === 'super_admin') {
    console.log('✅ Admin role detected:', req.user.role);
    return next();
  }
  
  console.log('❌ Admin access denied - no tokenId and role is:', req.user.role);
  return res.status(403).json({
    success: false,
    message: "Admin access required"
  });
};

// 🔹 POST /api/tasks/create - Admin creates a new task with auto-reassignment check
router.post("/create", authenticateToken, adminOnly, async (req, res) => {
  try {
    const {
      title,
      description,
      assignedTo,
      date,
      priority,
      category,
      location,
      estimatedDuration
    } = req.body;

    // Validate input
    if (!title || !assignedTo || !date || !category || !location) {
      return res.status(400).json({
        success: false,
        message: "Required fields: title, assignedTo, date, category, location"
      });
    }

    // Check if user exists
    const user = await User.findById(assignedTo);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Assigned user not found"
      });
    }

    // Create new task
    const newTask = new Task({
      title,
      description: description || '',
      assignedTo,
      assignedBy: req.user.id || req.user.tokenId || 'admin',
      date,
      priority: priority || 'medium',
      category,
      location,
      estimatedDuration: estimatedDuration || 60
    });

    await newTask.save();
    
    // Check if the assigned user is available on the task date
    let reassignmentResult = null;
    const isPresent = await autoReassignmentService.checkUserPresence(assignedTo, date);
    
    if (!isPresent) {
      console.log(`Assigned user is absent on ${date}, attempting auto-reassignment...`);
      
      try {
        reassignmentResult = await autoReassignmentService.autoReassignTask(newTask._id, 'user_absent');
      } catch (error) {
        console.log('Auto-reassignment failed:', error.message);
      }
    }

    await newTask.populate([
      { path: 'assignedTo', select: 'username email' },
      { path: 'originalAssignee', select: 'username email' }
    ]);

    const responseData = {
      success: true,
      message: "Task created successfully",
      task: newTask
    };

    if (reassignmentResult && reassignmentResult.success) {
      responseData.message = "Task created and automatically reassigned due to user absence";
      responseData.reassignmentDetails = reassignmentResult.reassignmentDetails;
    }

    res.status(201).json(responseData);

  } catch (error) {
    console.error("Create task error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create task",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 🔹 POST /api/tasks/check-reassignments - Check and reassign tasks for a specific date
router.post("/check-reassignments", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required (YYYY-MM-DD format)"
      });
    }

    const results = await autoReassignmentService.checkAndReassignForDate(date);

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.status(200).json({
      success: true,
      message: `Auto-reassignment check completed for ${date}`,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
        date: date
      },
      results: results
    });

  } catch (error) {
    console.error("Check reassignments error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check reassignments",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 🔹 POST /api/tasks/manual-reassign/:taskId - Manually reassign a task
router.post("/manual-reassign/:taskId", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { newUserId, reason } = req.body;

    if (!newUserId) {
      return res.status(400).json({
        success: false,
        message: "New user ID is required"
      });
    }

    const result = await autoReassignmentService.manualReassignTask(
      taskId, 
      newUserId, 
      reason || 'manual_override'
    );

    res.status(200).json(result);

  } catch (error) {
    console.error("Manual reassign error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to reassign task"
    });
  }
});

// 🔹 GET /api/tasks/available-users/:category/:date - Get available users for a category and date
router.get("/available-users/:category/:date", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { category, date } = req.params;
    const { excludeUserId } = req.query;

    const availableUsers = await autoReassignmentService.findAvailableUsers(
      category, 
      date, 
      excludeUserId
    );

    res.status(200).json({
      success: true,
      message: `Found ${availableUsers.length} available users for ${category} on ${date}`,
      users: availableUsers,
      category: category,
      date: date
    });

  } catch (error) {
    console.error("Get available users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get available users"
    });
  }
});

// 🔹 GET /api/tasks/reassignment-stats - Get reassignment statistics
router.get("/reassignment-stats", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { date } = req.query;
    
    const stats = await autoReassignmentService.getReassignmentStats(date);

    res.status(200).json({
      success: true,
      message: "Reassignment statistics retrieved",
      stats: stats,
      period: date || 'all-time'
    });

  } catch (error) {
    console.error("Get reassignment stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get reassignment statistics"
    });
  }
});

// 🔹 GET /api/tasks/my-tasks - Get current user's tasks
router.get("/my-tasks", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, date, priority, category } = req.query;

    let query = { assignedTo: userId };
    
    if (status) query.status = status;
    if (date) query.date = date;
    if (priority) query.priority = priority;
    if (category) query.category = category;

    const tasks = await Task.find(query)
      .populate('assignedBy', 'username email')
      .populate('originalAssignee', 'username email')
      .sort({ date: -1, priority: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      tasks,
      total: tasks.length
    });

  } catch (error) {
    console.error("Get my tasks error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch your tasks"
    });
  }
});

// 🔹 GET /api/tasks/today - Get today's tasks for current user
router.get("/today", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const tasks = await Task.find({ 
      assignedTo: userId, 
      date: today 
    })
    .populate('assignedBy', 'username email')
    .populate('originalAssignee', 'username email')
    .sort({ priority: 1, createdAt: -1 });

    const tasksByStatus = {
      pending: tasks.filter(t => t.status === 'pending'),
      'in-progress': tasks.filter(t => t.status === 'in-progress'),
      completed: tasks.filter(t => t.status === 'completed'),
      cancelled: tasks.filter(t => t.status === 'cancelled'),
      reassigned: tasks.filter(t => t.status === 'reassigned')
    };

    res.status(200).json({
      success: true,
      date: today,
      tasks,
      tasksByStatus,
      total: tasks.length,
      completed: tasksByStatus.completed.length,
      pending: tasksByStatus.pending.length + tasksByStatus['in-progress'].length,
      reassigned: tasksByStatus.reassigned.length
    });

  } catch (error) {
    console.error("Get today's tasks error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch today's tasks"
    });
  }
});

// 🔹 PUT /api/tasks/update-status/:taskId - Update task status
router.put("/update-status/:taskId", authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status, completionNotes } = req.body;
    const userId = req.user.id;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required"
      });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found"
      });
    }

    const isAdmin = req.user.tokenId || req.user.role === 'admin' || req.user.role === 'super_admin';
    if (task.assignedTo.toString() !== userId && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You can only update tasks assigned to you"
      });
    }

    task.status = status;
    if (completionNotes) {
      task.completionNotes = completionNotes;
    }

    if (status === 'completed' && !task.completedAt) {
      task.completedAt = new Date();
    }

    await task.save();
    await task.populate([
      { path: 'assignedTo', select: 'username email' },
      { path: 'assignedBy', select: 'username email' },
      { path: 'originalAssignee', select: 'username email' }
    ]);

    res.status(200).json({
      success: true,
      message: `Task marked as ${status}`,
      task
    });

  } catch (error) {
    console.error("Update task status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update task status"
    });
  }
});

// 🔹 PUT /api/tasks/rate/:taskId - Rate a completed task (admin only)
router.put("/rate/:taskId", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { rating } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5"
      });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found"
      });
    }

    if (task.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: "Can only rate completed tasks"
      });
    }

    task.rating = rating;
    await task.save();

    await task.populate([
      { path: 'assignedTo', select: 'username email' },
      { path: 'assignedBy', select: 'username email' },
      { path: 'originalAssignee', select: 'username email' }
    ]);

    res.status(200).json({
      success: true,
      message: "Task rated successfully",
      task
    });

  } catch (error) {
    console.error("Rate task error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to rate task"
    });
  }
});

// 🔹 GET /api/tasks/admin/all - Get all tasks (admin only) with reassignment info
router.get("/admin/all", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      priority, 
      category, 
      date,
      assignedTo,
      showReassigned
    } = req.query;

    let query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;
    if (date) query.date = date;
    if (assignedTo) query.assignedTo = assignedTo;
    if (showReassigned === 'true') query.isReassigned = true;
    if (showReassigned === 'false') query.isReassigned = { $ne: true };

    const tasks = await Task.find(query)
      .populate('assignedTo', 'username email')
      .populate('assignedBy', 'username email')
      .populate('originalAssignee', 'username email')
      .populate('reassignmentHistory.fromUser', 'username email')
      .populate('reassignmentHistory.toUser', 'username email')
      .sort({ date: -1, priority: 1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Task.countDocuments(query);

    res.status(200).json({
      success: true,
      tasks,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      },
      totalTasks: total
    });

  } catch (error) {
    console.error("Get all tasks error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch all tasks"
    });
  }
});

// 🔹 GET /api/tasks/admin/today-summary - Enhanced today's summary with reassignment info
router.get("/admin/today-summary", authenticateToken, adminOnly, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const todayTasks = await Task.find({ date: today })
      .populate('assignedTo', 'username email')
      .populate('originalAssignee', 'username email')
      .sort({ priority: 1 });

    const summary = {
      total: todayTasks.length,
      pending: todayTasks.filter(t => t.status === 'pending').length,
      inProgress: todayTasks.filter(t => t.status === 'in-progress').length,
      completed: todayTasks.filter(t => t.status === 'completed').length,
      cancelled: todayTasks.filter(t => t.status === 'cancelled').length,
      reassigned: todayTasks.filter(t => t.status === 'reassigned').length,
      autoReassigned: todayTasks.filter(t => t.isReassigned === true).length,
      highPriority: todayTasks.filter(t => t.priority === 'high' || t.priority === 'urgent').length,
      overdue: todayTasks.filter(t => t.status === 'pending' && new Date() > new Date(t.date + ' 23:59:59')).length
    };

    // Group by category
    const tasksByCategory = {};
    const reassignmentsByCategory = {};
    
    todayTasks.forEach(task => {
      if (!tasksByCategory[task.category]) {
        tasksByCategory[task.category] = 0;
      }
      tasksByCategory[task.category]++;

      if (task.isReassigned) {
        if (!reassignmentsByCategory[task.category]) {
          reassignmentsByCategory[task.category] = 0;
        }
        reassignmentsByCategory[task.category]++;
      }
    });

    res.status(200).json({
      success: true,
      date: today,
      summary,
      tasksByCategory,
      reassignmentsByCategory,
      tasks: todayTasks
    });

  } catch (error) {
    console.error("Get today's task summary error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch today's task summary"
    });
  }
});

// 🔹 PUT /api/tasks/update/:taskId - Update task details (admin only)
router.put("/update/:taskId", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;

    delete updates._id;
    delete updates.assignedBy;
    delete updates.createdAt;
    delete updates.updatedAt;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found"
      });
    }

    Object.keys(updates).forEach(key => {
      task[key] = updates[key];
    });

    await task.save();
    await task.populate([
      { path: 'assignedTo', select: 'username email' },
      { path: 'assignedBy', select: 'username email' },
      { path: 'originalAssignee', select: 'username email' }
    ]);

    res.status(200).json({
      success: true,
      message: "Task updated successfully",
      task
    });

  } catch (error) {
    console.error("Update task error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update task"
    });
  }
});

// 🔹 DELETE /api/tasks/delete/:taskId - Delete task (admin only)
router.delete("/delete/:taskId", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found"
      });
    }

    await Task.findByIdAndDelete(taskId);

    res.status(200).json({
      success: true,
      message: "Task deleted successfully",
      deletedTask: {
        id: task._id,
        title: task.title,
        category: task.category,
        wasReassigned: task.isReassigned
      }
    });

  } catch (error) {
    console.error("Delete task error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete task"
    });
  }
});

// 🔹 GET /api/tasks/user-performance/:userId - Get user's task performance
router.get("/user-performance/:userId", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { userId } = req.params;
    const { month, year } = req.query;

    let query = { assignedTo: userId };
    
    if (month && year) {
      const startDate = `${year}-${month.padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      query.date = { $gte: startDate, $lte: endDate };
    }

    const tasks = await Task.find(query);

    const performance = {
      totalTasks: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length,
      reassignedToMe: tasks.filter(t => t.isReassigned && t.assignedTo.toString() === userId).length,
      reassignedFromMe: tasks.filter(t => t.originalAssignee && t.originalAssignee.toString() === userId).length,
      averageRating: 0,
      completionRate: 0
    };

    if (performance.totalTasks > 0) {
      performance.completionRate = Math.round((performance.completed / performance.totalTasks) * 100);
    }

    const ratedTasks = tasks.filter(t => t.rating && t.rating > 0);
    if (ratedTasks.length > 0) {
      performance.averageRating = Math.round(
        (ratedTasks.reduce((sum, task) => sum + task.rating, 0) / ratedTasks.length) * 10
      ) / 10;
    }

    res.status(200).json({
      success: true,
      userId,
      performance,
      period: month && year ? `${year}-${month}` : 'all-time'
    });

  } catch (error) {
    console.error("Get user performance error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user performance"
    });
  }
});

// 🔹 POST /api/tasks/bulk-assign - Bulk assign tasks with auto-reassignment
router.post("/bulk-assign", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { tasks } = req.body;

    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({
        success: false,
        message: "Tasks array is required"
      });
    }

    const results = {
      successful: [],
      failed: [],
      reassigned: []
    };

    for (const taskData of tasks) {
      try {
        const {
          title,
          description,
          assignedTo,
          date,
          priority,
          category,
          location,
          estimatedDuration
        } = taskData;

        if (!title || !assignedTo || !date || !category || !location) {
          results.failed.push({
            task: taskData,
            reason: "Missing required fields"
          });
          continue;
        }

        const user = await User.findById(assignedTo);
        if (!user) {
          results.failed.push({
            task: taskData,
            reason: "User not found"
          });
          continue;
        }

        const newTask = new Task({
          title,
          description: description || '',
          assignedTo,
          assignedBy: req.user.id || req.user.tokenId || 'admin',
          date,
          priority: priority || 'medium',
          category,
          location,
          estimatedDuration: estimatedDuration || 60
        });

        await newTask.save();

        // Check for auto-reassignment
        const isPresent = await autoReassignmentService.checkUserPresence(assignedTo, date);
        if (!isPresent) {
          try {
            const reassignResult = await autoReassignmentService.autoReassignTask(newTask._id, 'user_absent');
            if (reassignResult.success) {
              results.reassigned.push({
                task: newTask,
                reassignmentDetails: reassignResult.reassignmentDetails
              });
            }
          } catch (error) {
            console.log('Auto-reassignment failed for bulk task:', error.message);
          }
        }

        results.successful.push(newTask);

      } catch (error) {
        results.failed.push({
          task: taskData,
          reason: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk assignment completed. ${results.successful.length} successful, ${results.failed.length} failed, ${results.reassigned.length} auto-reassigned.`,
      results
    });

  } catch (error) {
    console.error("Bulk assign tasks error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to bulk assign tasks"
    });
  }
});

module.exports = router;