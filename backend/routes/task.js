const express = require("express");
const router = express.Router();
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

// Updated Admin check middleware to work with your admin token structure
const adminOnly = (req, res, next) => {
  console.log('🔍 Admin check - req.user:', req.user);
  
  // Check if it's an admin token (your admin tokens have tokenId field)
  if (req.user.tokenId) {
    // This is an admin token - allow access
    console.log('✅ Admin token detected with tokenId:', req.user.tokenId);
    return next();
  }
  
  // Fallback: check for role field (for regular user tokens that might have admin role)
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

// 🔹 POST /api/tasks/create - Admin creates a new task
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

    // Create new task - use a default admin ID if req.user.id doesn't exist
    const newTask = new Task({
      title,
      description: description || '',
      assignedTo,
      assignedBy: req.user.id || req.user.tokenId || 'admin', // Fallback for admin tokens
      date,
      priority: priority || 'medium',
      category,
      location,
      estimatedDuration: estimatedDuration || 60
    });

    await newTask.save();
    await newTask.populate('assignedTo', 'username email');

    res.status(201).json({
      success: true,
      message: "Task created successfully",
      task: newTask
    });

  } catch (error) {
    console.error("Create task error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create task",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 🔹 GET /api/tasks/my-tasks - Get current user's tasks
router.get("/my-tasks", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, date, priority, category } = req.query;

    // Build query
    let query = { assignedTo: userId };
    
    if (status) query.status = status;
    if (date) query.date = date;
    if (priority) query.priority = priority;
    if (category) query.category = category;

    const tasks = await Task.find(query)
      .populate('assignedBy', 'username email')
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
    .sort({ priority: 1, createdAt: -1 });

    // Group by status
    const tasksByStatus = {
      pending: tasks.filter(t => t.status === 'pending'),
      'in-progress': tasks.filter(t => t.status === 'in-progress'),
      completed: tasks.filter(t => t.status === 'completed'),
      cancelled: tasks.filter(t => t.status === 'cancelled')
    };

    res.status(200).json({
      success: true,
      date: today,
      tasks,
      tasksByStatus,
      total: tasks.length,
      completed: tasksByStatus.completed.length,
      pending: tasksByStatus.pending.length + tasksByStatus['in-progress'].length
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

    // Check if user is assigned to this task or is admin (updated check)
    const isAdmin = req.user.tokenId || req.user.role === 'admin' || req.user.role === 'super_admin';
    if (task.assignedTo.toString() !== userId && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You can only update tasks assigned to you"
      });
    }

    // Update status
    task.status = status;
    if (completionNotes) {
      task.completionNotes = completionNotes;
    }

    // Set completion time if completed
    if (status === 'completed' && !task.completedAt) {
      task.completedAt = new Date();
    }

    await task.save();
    await task.populate('assignedTo', 'username email');
    await task.populate('assignedBy', 'username email');

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

    await task.populate('assignedTo', 'username email');
    await task.populate('assignedBy', 'username email');

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

// 🔹 GET /api/tasks/admin/all - Get all tasks (admin only)
router.get("/admin/all", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      priority, 
      category, 
      date,
      assignedTo
    } = req.query;

    // Build query
    let query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;
    if (date) query.date = date;
    if (assignedTo) query.assignedTo = assignedTo;

    const tasks = await Task.find(query)
      .populate('assignedTo', 'username email')
      .populate('assignedBy', 'username email')
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

// 🔹 GET /api/tasks/admin/today-summary - Get today's task summary (admin only)
router.get("/admin/today-summary", authenticateToken, adminOnly, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const todayTasks = await Task.find({ date: today })
      .populate('assignedTo', 'username email')
      .sort({ priority: 1 });

    const summary = {
      total: todayTasks.length,
      pending: todayTasks.filter(t => t.status === 'pending').length,
      inProgress: todayTasks.filter(t => t.status === 'in-progress').length,
      completed: todayTasks.filter(t => t.status === 'completed').length,
      cancelled: todayTasks.filter(t => t.status === 'cancelled').length,
      highPriority: todayTasks.filter(t => t.priority === 'high' || t.priority === 'urgent').length,
      overdue: todayTasks.filter(t => t.status === 'pending' && new Date() > new Date(t.date + ' 23:59:59')).length
    };

    // Group by category
    const tasksByCategory = {};
    todayTasks.forEach(task => {
      if (!tasksByCategory[task.category]) {
        tasksByCategory[task.category] = 0;
      }
      tasksByCategory[task.category]++;
    });

    res.status(200).json({
      success: true,
      date: today,
      summary,
      tasksByCategory,
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

    // Remove fields that shouldn't be updated
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

    // Update task
    Object.keys(updates).forEach(key => {
      task[key] = updates[key];
    });

    await task.save();
    await task.populate('assignedTo', 'username email');
    await task.populate('assignedBy', 'username email');

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
        category: task.category
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
    
    // Filter by month/year if provided
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
      averageRating: 0,
      completionRate: 0
    };

    // Calculate completion rate
    if (performance.totalTasks > 0) {
      performance.completionRate = Math.round((performance.completed / performance.totalTasks) * 100);
    }

    // Calculate average rating
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

// 🔹 POST /api/tasks/bulk-assign - Bulk assign tasks
router.post("/bulk-assign", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { tasks } = req.body; // Array of task objects

    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({
        success: false,
        message: "Tasks array is required"
      });
    }

    const results = {
      successful: [],
      failed: []
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

        // Validate required fields
        if (!title || !assignedTo || !date || !category || !location) {
          results.failed.push({
            task: taskData,
            reason: "Missing required fields"
          });
          continue;
        }

        // Check if user exists
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
          assignedBy: req.user.id || req.user.tokenId || 'admin', // Fallback for admin tokens
          date,
          priority: priority || 'medium',
          category,
          location,
          estimatedDuration: estimatedDuration || 60
        });

        await newTask.save();
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
      message: `Bulk assignment completed. ${results.successful.length} successful, ${results.failed.length} failed.`,
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