const express = require("express");
const router = express.Router();
const Task = require("../models/task");
const User = require("../models/user");
const UserProfile = require("../models/userprofile");
const jwt = require("jsonwebtoken");

// Auto-reassignment service
class AutoReassignmentService {
  async findAvailableUsers(category, date, excludeUserId = null) {
    try {
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

        const isPresent = await this.checkUserPresence(user._id, date);
        if (!isPresent) {
          continue;
        }

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

  async checkUserPresence(userId, date) {
    try {
      return true; // Placeholder - implement your attendance system
    } catch (error) {
      console.error('Error checking user presence:', error);
      return false;
    }
  }

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

      task.originalAssignee = task.assignedTo;
      task.assignedTo = selectedUser.user._id;
      task.isReassigned = true;
      task.reassignmentReason = reason;
      task.reassignedAt = new Date();
      task.status = 'reassigned';

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

// ========================================
// TASK MANAGEMENT ROUTES
// ========================================

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

    if (!title || !assignedTo || !date || !category || !location) {
      return res.status(400).json({
        success: false,
        message: "Required fields: title, assignedTo, date, category, location"
      });
    }

    const user = await User.findById(assignedTo);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Assigned user not found"
      });
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
      { path: 'assignedTo', select: 'username email name' },
      { path: 'originalAssignee', select: 'username email name' }
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

// 🔹 GET /api/tasks/my-tasks - Get current user's tasks with verification info
router.get("/my-tasks", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, date, priority, category, includeVerification } = req.query;

    let query = { assignedTo: userId };
    
    if (status) query.status = status;
    if (date) query.date = date;
    if (priority) query.priority = priority;
    if (category) query.category = category;

    const tasks = await Task.find(query)
      .populate('assignedBy', 'username email name')
      .populate('originalAssignee', 'username email name')
      .populate('verifierId', 'username email name')
      .sort({ date: -1, priority: 1, createdAt: -1 });

    const tasksWithVerification = tasks.map(task => {
      const taskObj = task.toObject();
      
      if (includeVerification === 'true') {
        taskObj.verificationSummary = task.getVerificationSummary();
        taskObj.needsVerification = task.needsVerification();
        taskObj.isVerificationComplete = task.isVerificationComplete();
      }
      
      return taskObj;
    });

    res.status(200).json({
      success: true,
      tasks: tasksWithVerification,
      total: tasks.length,
      verificationStats: includeVerification === 'true' ? {
        needsVerification: tasks.filter(t => t.needsVerification()).length,
        verificationComplete: tasks.filter(t => t.isVerificationComplete()).length,
        verificationPending: tasks.filter(t => t.verificationStatus === 'pending_verification').length
      } : null
    });

  } catch (error) {
    console.error("Get my tasks error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch your tasks"
    });
  }
});

// 🔹 GET /api/tasks/today - Get today's tasks for current user with verification
router.get("/today", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const tasks = await Task.find({ 
      assignedTo: userId, 
      date: today 
    })
    .populate('assignedBy', 'username email name')
    .populate('originalAssignee', 'username email name')
    .populate('verifierId', 'username email name')
    .sort({ priority: 1, createdAt: -1 });

    const tasksByStatus = {
      pending: tasks.filter(t => t.status === 'pending'),
      'in-progress': tasks.filter(t => t.status === 'in-progress'),
      completed: tasks.filter(t => t.status === 'completed'),
      cancelled: tasks.filter(t => t.status === 'cancelled'),
      reassigned: tasks.filter(t => t.status === 'reassigned')
    };

    const verificationStats = {
      needsVerification: tasks.filter(t => t.needsVerification()).length,
      pendingVerification: tasks.filter(t => t.verificationStatus === 'pending_verification').length,
      verificationComplete: tasks.filter(t => t.isVerificationComplete()).length,
      verificationApproved: tasks.filter(t => t.finalVerificationStatus === 'approved').length
    };

    res.status(200).json({
      success: true,
      date: today,
      tasks,
      tasksByStatus,
      verificationStats,
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

    const oldStatus = task.status;
    task.status = status;
    if (completionNotes) {
      task.completionNotes = completionNotes;
    }

    if (status === 'completed' && !task.completedAt) {
      task.completedAt = new Date();
    }

    await task.save();

    await task.populate([
      { path: 'assignedTo', select: 'username email name' },
      { path: 'assignedBy', select: 'username email name' },
      { path: 'originalAssignee', select: 'username email name' },
      { path: 'verifierId', select: 'username email name' }
    ]);

    const responseData = {
      success: true,
      message: `Task marked as ${status}`,
      task,
      verificationSummary: task.getVerificationSummary()
    };

    res.status(200).json(responseData);

  } catch (error) {
    console.error("Update task status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update task status"
    });
  }
});

// ========================================
// 🔥 SIMPLE VERIFICATION ROUTES
// ========================================

// 🔹 POST /api/tasks/assign-verifier/:taskId - Manually assign single verifier (FOR FRONTEND)
router.post("/assign-verifier/:taskId", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { verifierId } = req.body;

    console.log('🔍 Assign verifier request:', { taskId, verifierId });

    if (!verifierId) {
      return res.status(400).json({
        success: false,
        message: "Verifier ID is required"
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
        message: "Task must be completed before verification"
      });
    }

    // Check if verifier exists
    const verifier = await User.findById(verifierId);
    if (!verifier) {
      return res.status(404).json({
        success: false,
        message: "Verifier not found"
      });
    }

    // Check if verification already assigned
    if (task.verifierId) {
      return res.status(400).json({
        success: false,
        message: "Verification already assigned to this task"
      });
    }

    // Update task with verification details
    task.verificationStatus = 'pending_verification';
    task.verifierId = verifierId;
    task.verificationAssignedAt = new Date();

    await task.save();

    await task.populate([
      { path: 'verifierId', select: 'username email name' },
      { path: 'assignedTo', select: 'username email name' }
    ]);

    console.log('✅ Verifier assigned successfully:', {
      taskId: task._id,
      taskTitle: task.title,
      verifier: task.verifierId.username
    });

    res.json({
      success: true,
      message: "Verifier assigned successfully",
      task: {
        id: task._id,
        title: task.title,
        verifierId: task.verifierId,
        verificationStatus: task.verificationStatus,
        verificationAssignedAt: task.verificationAssignedAt
      }
    });

  } catch (error) {
    console.error('Assign verifier error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error: ' + error.message
    });
  }
});

// 🔹 GET /api/tasks/needs-verification - Get tasks needing verification assignment
router.get("/needs-verification", authenticateToken, adminOnly, async (req, res) => {
  try {
    const tasks = await Task.getTasksNeedingVerification()
      .populate('assignedTo', 'username email name')
      .populate('assignedBy', 'username email name')
      .sort({ completedAt: -1 });

    console.log('📋 Tasks needing verification:', tasks.length);

    res.status(200).json({
      success: true,
      message: `Found ${tasks.length} tasks needing verification`,
      tasks: tasks.map(task => ({
        id: task._id,
        title: task.title,
        category: task.category,
        location: task.location,
        priority: task.priority,
        completedAt: task.completedAt,
        assignedTo: task.assignedTo,
        needsVerification: task.needsVerification()
      })),
      total: tasks.length
    });

  } catch (error) {
    console.error("Get tasks needing verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get tasks needing verification"
    });
  }
});

// 🔹 GET /api/tasks/my-verification-tasks - Get verification tasks for current user (verifier view)
router.get("/my-verification-tasks", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    let query = { verifierId: userId };
    if (status) query.verificationStatus = status;

    const tasks = await Task.find(query)
      .populate('assignedTo', 'username email name')
      .populate('assignedBy', 'username email name')
      .sort({ verificationAssignedAt: -1 });

    const verificationTasks = tasks.map(task => ({
      id: task._id,
      title: task.title,
      description: task.description,
      category: task.category,
      location: task.location,
      priority: task.priority,
      assignedTo: task.assignedTo,
      completedAt: task.completedAt,
      verificationStatus: task.verificationStatus,
      verificationAssignedAt: task.verificationAssignedAt,
      verificationScore: task.verificationScore,
      verificationResult: task.verificationResult,
      verificationNotes: task.verificationNotes,
      isOverdue: task.verificationAssignedAt && 
                  new Date() > new Date(task.verificationAssignedAt.getTime() + 24 * 60 * 60 * 1000)
    }));

    res.status(200).json({
      success: true,
      tasks: verificationTasks,
      total: verificationTasks.length,
      summary: {
        pending: verificationTasks.filter(t => t.verificationStatus === 'pending_verification').length,
        completed: verificationTasks.filter(t => t.verificationStatus === 'completed').length,
        overdue: verificationTasks.filter(t => t.isOverdue).length
      }
    });

  } catch (error) {
    console.error("Get my verification tasks error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get your verification tasks"
    });
  }
});

// 🔹 PUT /api/tasks/submit-verification/:taskId - Submit verification result
router.put("/submit-verification/:taskId", authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { score, result, notes } = req.body;
    const userId = req.user.id;

    if (!score || !result) {
      return res.status(400).json({
        success: false,
        message: "Score and result are required"
      });
    }

    if (score < 1 || score > 5) {
      return res.status(400).json({
        success: false,
        message: "Score must be between 1 and 5"
      });
    }

    if (!['pass', 'fail', 'recheck'].includes(result)) {
      return res.status(400).json({
        success: false,
        message: "Result must be 'pass', 'fail', or 'recheck'"
      });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found"
      });
    }

    // Check if user is assigned verifier
    if (!task.verifierId || task.verifierId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to verify this task"
      });
    }

    if (task.verificationStatus === 'completed') {
      return res.status(400).json({
        success: false,
        message: "Verification already completed for this task"
      });
    }

    // Update verification
    task.verificationStatus = 'completed';
    task.verificationScore = parseInt(score);
    task.verificationResult = result;
    task.verificationNotes = notes || '';
    task.verificationCompletedAt = new Date();

    await task.save();

    await task.populate([
      { path: 'assignedTo', select: 'username email name' },
      { path: 'verifierId', select: 'username email name' }
    ]);

    res.status(200).json({
      success: true,
      message: "Verification submitted successfully",
      verification: {
        taskId: task._id,
        taskTitle: task.title,
        score: task.verificationScore,
        result: task.verificationResult,
        notes: task.verificationNotes,
        finalStatus: task.finalVerificationStatus
      }
    });

  } catch (error) {
    console.error("Submit verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit verification"
    });
  }
});

// 🔹 GET /api/tasks/verification-status/:taskId - Get verification status for a task
router.get("/verification-status/:taskId", authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const task = await Task.findById(taskId)
      .populate('verifierId', 'username email name')
      .populate('assignedTo', 'username email name');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found"
      });
    }

    // Check access permissions
    const isAdmin = req.user.tokenId || req.user.role === 'admin' || req.user.role === 'super_admin';
    const isTaskOwner = task.assignedTo._id.toString() === req.user.id;
    const isVerifier = task.verifierId && task.verifierId._id.toString() === req.user.id;
    
    if (!isAdmin && !isTaskOwner && !isVerifier) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const verificationSummary = task.getVerificationSummary();
    
    res.status(200).json({
      success: true,
      task: {
        id: task._id,
        title: task.title,
        status: task.status,
        verificationStatus: task.verificationStatus,
        verificationResult: task.verificationResult,
        finalVerificationStatus: task.finalVerificationStatus,
        verificationScore: task.verificationScore,
        verificationNotes: task.verificationNotes,
        verifierId: task.verifierId,
        verificationAssignedAt: task.verificationAssignedAt,
        verificationCompletedAt: task.verificationCompletedAt
      },
      verificationSummary,
      needsVerification: task.needsVerification(),
      isVerificationComplete: task.isVerificationComplete(),
      isVerificationPending: task.isVerificationPending()
    });

  } catch (error) {
    console.error("Get verification status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get verification status"
    });
  }
});

// ========================================
// ADMIN ROUTES WITH VERIFICATION
// ========================================

// 🔹 GET /api/tasks/admin/all - Get all tasks (admin only) with verification info
router.get("/admin/all", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, // Increased default limit
      status, 
      priority, 
      category, 
      date,
      assignedTo,
      showReassigned,
      verificationStatus,
      verificationResult
    } = req.query;

    let query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;
    if (date) query.date = date;
    if (assignedTo) query.assignedTo = assignedTo;
    if (showReassigned === 'true') query.isReassigned = true;
    if (showReassigned === 'false') query.isReassigned = { $ne: true };
    if (verificationStatus) query.verificationStatus = verificationStatus;
    if (verificationResult) query.verificationResult = verificationResult;

    const tasks = await Task.find(query)
      .populate('assignedTo', 'username email name department jobTitle')
      .populate('assignedBy', 'username email name')
      .populate('originalAssignee', 'username email name')
      .populate('verifierId', 'username email name department jobTitle')
      .populate('reassignmentHistory.fromUser', 'username email name')
      .populate('reassignmentHistory.toUser', 'username email name')
      .sort({ date: -1, priority: 1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Task.countDocuments(query);

    // Add verification summaries
    const tasksWithVerification = tasks.map(task => {
      const taskObj = task.toObject();
      taskObj.verificationSummary = task.getVerificationSummary();
      taskObj.needsVerification = task.needsVerification();
      taskObj.isVerificationComplete = task.isVerificationComplete();
      taskObj.isVerificationPending = task.isVerificationPending();
      return taskObj;
    });

    console.log(`📊 Admin fetched ${tasks.length}/${total} tasks`);

    res.status(200).json({
      success: true,
      tasks: tasksWithVerification,
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

// 🔹 GET /api/tasks/admin/dashboard - Enhanced admin dashboard with verification
router.get("/admin/dashboard", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    
    // Calculate date range
    let startDate = new Date();
    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      default:
        startDate.setHours(0, 0, 0, 0);
    }

    const tasks = await Task.find({
      createdAt: { $gte: startDate }
    })
    .populate('assignedTo', 'username email name')
    .populate('verifierId', 'username email name')
    .sort({ createdAt: -1 });

    // Calculate task statistics
    const taskStats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length,
      reassigned: tasks.filter(t => t.status === 'reassigned').length,
      autoReassigned: tasks.filter(t => t.isReassigned === true).length,
      highPriority: tasks.filter(t => t.priority === 'high' || t.priority === 'urgent').length,
      overdue: tasks.filter(t => t.status === 'pending' && new Date() > new Date(t.date + ' 23:59:59')).length
    };

    // Verification statistics
    const verificationStats = {
      needsVerification: tasks.filter(t => t.needsVerification()).length,
      pendingVerification: tasks.filter(t => t.verificationStatus === 'pending_verification').length,
      verificationComplete: tasks.filter(t => t.isVerificationComplete()).length,
      verificationApproved: tasks.filter(t => t.finalVerificationStatus === 'approved').length,
      verificationRejected: tasks.filter(t => t.finalVerificationStatus === 'rejected').length,
      averageScore: 0
    };

    // Calculate average verification score
    const scoredTasks = tasks.filter(t => t.verificationScore > 0);
    if (scoredTasks.length > 0) {
      verificationStats.averageScore = Math.round(
        (scoredTasks.reduce((sum, task) => sum + task.verificationScore, 0) / scoredTasks.length) * 10
      ) / 10;
    }

    // Group by category
    const tasksByCategory = {};
    
    tasks.forEach(task => {
      if (!tasksByCategory[task.category]) {
        tasksByCategory[task.category] = { total: 0, completed: 0, verified: 0, avgScore: 0, scores: [] };
      }
      tasksByCategory[task.category].total++;
      
      if (task.status === 'completed') {
        tasksByCategory[task.category].completed++;
      }
      
      if (task.isVerificationComplete()) {
        tasksByCategory[task.category].verified++;
        if (task.verificationScore) {
          tasksByCategory[task.category].scores.push(task.verificationScore);
        }
      }
    });

    // Calculate category averages
    Object.keys(tasksByCategory).forEach(cat => {
      const scores = tasksByCategory[cat].scores;
      if (scores.length > 0) {
        tasksByCategory[cat].avgScore = Math.round(
          (scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10
        ) / 10;
      }
      delete tasksByCategory[cat].scores;
    });

    const recentTasks = tasks.slice(0, 15).map(task => ({
      id: task._id,
      title: task.title,
      category: task.category,
      status: task.status,
      priority: task.priority,
      assignedTo: task.assignedTo?.username || 'Unknown',
      verificationStatus: task.verificationStatus,
      verificationResult: task.verificationResult,
      verificationScore: task.verificationScore,
      finalVerificationStatus: task.finalVerificationStatus,
      needsVerification: task.needsVerification(),
      isVerificationComplete: task.isVerificationComplete(),
      date: task.date,
      completedAt: task.completedAt
    }));

    res.status(200).json({
      success: true,
      period,
      taskStats,
      verificationStats,
      tasksByCategory,
      recentTasks,
      summary: {
        completionRate: taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0,
        verificationRate: taskStats.completed > 0 ? Math.round((verificationStats.verificationComplete / taskStats.completed) * 100) : 0,
        approvalRate: verificationStats.verificationComplete > 0 ? Math.round((verificationStats.verificationApproved / verificationStats.verificationComplete) * 100) : 0,
        reassignmentRate: taskStats.total > 0 ? Math.round((taskStats.autoReassigned / taskStats.total) * 100) : 0
      }
    });

  } catch (error) {
    console.error("Get admin dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get admin dashboard"
    });
  }
});

// ========================================
// EXISTING ROUTES (Reassignment, etc.)
// ========================================

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

// 🔹 PUT /api/tasks/update/:taskId - Update task details (admin only)
router.put("/update/:taskId", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;

    // Prevent updating certain fields
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

    // Update fields
    Object.keys(updates).forEach(key => {
      task[key] = updates[key];
    });

    await task.save();
    await task.populate([
      { path: 'assignedTo', select: 'username email name' },
      { path: 'assignedBy', select: 'username email name' },
      { path: 'originalAssignee', select: 'username email name' },
      { path: 'verifierId', select: 'username email name' }
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

module.exports = router;