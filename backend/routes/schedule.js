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

    // Create new task
    const newTask = new Task({
      title,
      description: description || '',
      assignedTo,
      assignedBy: req.user.id,
      date,
      priority: priority || 'medium',
      category,
      location,
      estimatedDuration: estimatedDuration || 60
    });

    await newTask.save();
    await newTask.populate('assignedTo', 'username email');
    await newTask.populate('assignedBy', 'username email');

    res.status(201).json({
      success: true,
      message: "Task created successfully",
      task: newTask
    });

  } catch (error) {
    console.error("Create task error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create task"
    });
  }
});

// 🔹 POST /api/tasks/bulk-create - Admin creates multiple tasks
router.post("/bulk-create", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { tasks } = req.body;

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Tasks array is required"
      });
    }

    const createdTasks = [];
    const errors = [];

    for (let i = 0; i < tasks.length; i++) {
      try {
        const task = tasks[i];
        
        // Validate required fields
        if (!task.title || !task.assignedTo || !task.date || !task.category || !task.location) {
          errors.push({
            index: i,
            message: "Required fields missing: title, assignedTo, date, category, location"
          });
          continue;
        }

        // Check if user exists
        const user = await User.findById(task.assignedTo);
        if (!user) {
          errors.push({
            index: i,
            message: "Assigned user not found"
          });
          continue;
        }

        const newTask = new Task({
          title: task.title,
          description: task.description || '',
          assignedTo: task.assignedTo,
          assignedBy: req.user.id,
          date: task.date,
          priority: task.priority || 'medium',
          category: task.category,
          location: task.location,
          estimatedDuration: task.estimatedDuration || 60
        });

        await newTask.save();
        await newTask.populate('assignedTo', 'username email');
        await newTask.populate('assignedBy', 'username email');
        
        createdTasks.push(newTask);

      } catch (error) {
        errors.push({
          index: i,
          message: error.message
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `${createdTasks.length} tasks created successfully`,
      createdTasks,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        total: tasks.length,
        created: createdTasks.length,
        failed: errors.length
      }
    });

  } catch (error) {
    console.error("Bulk create tasks error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create tasks"
    });
  }
});

// 🔹 GET /api/tasks/my-tasks - Get current user's tasks
router.get("/my-tasks", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, date, priority, category, page = 1, limit = 20 } = req.query;

    // Build query
    let query = { assignedTo: userId };
    
    if (status) query.status = status;
    if (date) query.date = date;
    if (priority) query.priority = priority;
    if (category) query.category = category;

    const tasks = await Task.find(query)
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

    // Calculate completion stats
    const completedToday = tasksByStatus.completed.length;
    const totalToday = tasks.length;
    const completionRate = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

    res.status(200).json({
      success: true,
      date: today,
      tasks,
      tasksByStatus,
      stats: {
        total: totalToday,
        completed: completedToday,
        pending: tasksByStatus.pending.length + tasksByStatus['in-progress'].length,
        completionRate
      }
    });

  } catch (error) {
    console.error("Get today's tasks error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch today's tasks"
    });
  }
});

// 🔹 GET /api/tasks/upcoming - Get upcoming tasks for current user
router.get("/upcoming", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 7 } = req.query;
    
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + parseInt(days));

    const todayStr = today.toISOString().split('T')[0];
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const tasks = await Task.find({
      assignedTo: userId,
      date: { $gt: todayStr, $lte: futureDateStr },
      status: { $in: ['pending', 'in-progress'] }
    })
    .populate('assignedBy', 'username email')
    .sort({ date: 1, priority: 1 });

    // Group by date
    const tasksByDate = {};
    tasks.forEach(task => {
      if (!tasksByDate[task.date]) {
        tasksByDate[task.date] = [];
      }
      tasksByDate[task.date].push(task);
    });

    res.status(200).json({
      success: true,
      tasks,
      tasksByDate,
      period: {
        from: todayStr,
        to: futureDateStr,
        days: parseInt(days)
      },
      total: tasks.length
    });

  } catch (error) {
    console.error("Get upcoming tasks error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch upcoming tasks"
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

    const validStatuses = ['pending', 'in-progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be one of: " + validStatuses.join(', ')
      });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found"
      });
    }

    // Check if user is assigned to this task or is admin
    if (task.assignedTo.toString() !== userId && req.user.role !== 'admin') {
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

    // Clear completion time if status changed from completed
    if (status !== 'completed' && task.completedAt) {
      task.completedAt = null;
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
    const { rating, feedback } = req.body;

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
    if (feedback) {
      task.feedback = feedback;
    }
    task.ratedBy = req.user.id;
    task.ratedAt = new Date();

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
      assignedTo,
      search
    } = req.query;

    // Build query
    let query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;
    if (date) query.date = date;
    if (assignedTo) query.assignedTo = assignedTo;

    // Add search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    const tasks = await Task.find(query)
      .populate('assignedTo', 'username email')
      .populate('assignedBy', 'username email')
      .sort({ date: -1, priority: 1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Task.countDocuments(query);

    // Get summary statistics
    const allTasks = await Task.find(query);
    const summary = {
      total: allTasks.length,
      pending: allTasks.filter(t => t.status === 'pending').length,
      inProgress: allTasks.filter(t => t.status === 'in-progress').length,
      completed: allTasks.filter(t => t.status === 'completed').length,
      cancelled: allTasks.filter(t => t.status === 'cancelled').length
    };

    res.status(200).json({
      success: true,
      tasks,
      summary,
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

    // Calculate completion rate
    summary.completionRate = summary.total > 0 ? 
      Math.round((summary.completed / summary.total) * 100) : 0;

    // Group by category
    const tasksByCategory = {};
    todayTasks.forEach(task => {
      if (!tasksByCategory[task.category]) {
        tasksByCategory[task.category] = {
          total: 0,
          completed: 0,
          pending: 0,
          inProgress: 0
        };
      }
      tasksByCategory[task.category].total++;
      tasksByCategory[task.category][task.status === 'in-progress' ? 'inProgress' : task.status]++;
    });

    // Group by user
    const tasksByUser = {};
    todayTasks.forEach(task => {
      const userId = task.assignedTo._id.toString();
      const username = task.assignedTo.username;
      
      if (!tasksByUser[userId]) {
        tasksByUser[userId] = {
          username,
          total: 0,
          completed: 0,
          pending: 0,
          inProgress: 0
        };
      }
      tasksByUser[userId].total++;
      tasksByUser[userId][task.status === 'in-progress' ? 'inProgress' : task.status]++;
    });

    res.status(200).json({
      success: true,
      date: today,
      summary,
      tasksByCategory,
      tasksByUser,
      recentTasks: todayTasks.slice(0, 10) // Show last 10 tasks
    });

  } catch (error) {
    console.error("Get today's task summary error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch today's task summary"
    });
  }
});

// 🔹 GET /api/tasks/admin/analytics - Get task analytics (admin only)
router.get("/admin/analytics", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { period = 'month', startDate, endDate } = req.query;

    let dateQuery = {};
    const now = new Date();

    if (startDate && endDate) {
      dateQuery.date = { $gte: startDate, $lte: endDate };
    } else {
      switch (period) {
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateQuery.date = { $gte: weekAgo.toISOString().split('T')[0] };
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          dateQuery.date = { $gte: monthAgo.toISOString().split('T')[0] };
          break;
        case 'quarter':
          const quarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          dateQuery.date = { $gte: quarterAgo.toISOString().split('T')[0] };
          break;
      }
    }

    const tasks = await Task.find(dateQuery)
      .populate('assignedTo', 'username email department')
      .populate('assignedBy', 'username email');

    // Overall statistics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

    // Average rating
    const ratedTasks = completedTasks.filter(t => t.rating);
    const averageRating = ratedTasks.length > 0 ? 
      Math.round((ratedTasks.reduce((sum, t) => sum + t.rating, 0) / ratedTasks.length) * 10) / 10 : 0;

    // Category analysis
    const categoryStats = {};
    tasks.forEach(task => {
      if (!categoryStats[task.category]) {
        categoryStats[task.category] = {
          total: 0,
          completed: 0,
          averageRating: 0,
          ratedTasks: []
        };
      }
      categoryStats[task.category].total++;
      if (task.status === 'completed') {
        categoryStats[task.category].completed++;
        if (task.rating) {
          categoryStats[task.category].ratedTasks.push(task.rating);
        }
      }
    });

    // Calculate averages for categories
    Object.keys(categoryStats).forEach(category => {
      const stats = categoryStats[category];
      stats.completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
      stats.averageRating = stats.ratedTasks.length > 0 ? 
        Math.round((stats.ratedTasks.reduce((sum, r) => sum + r, 0) / stats.ratedTasks.length) * 10) / 10 : 0;
      delete stats.ratedTasks; // Remove temporary array
    });

    // Top performers
    const userStats = {};
    tasks.forEach(task => {
      const userId = task.assignedTo._id.toString();
      if (!userStats[userId]) {
        userStats[userId] = {
          username: task.assignedTo.username,
          email: task.assignedTo.email,
          department: task.assignedTo.department,
          total: 0,
          completed: 0,
          ratings: []
        };
      }
      userStats[userId].total++;
      if (task.status === 'completed') {
        userStats[userId].completed++;
        if (task.rating) {
          userStats[userId].ratings.push(task.rating);
        }
      }
    });

    // Process user stats
    const topPerformers = Object.values(userStats)
      .map(user => ({
        ...user,
        completionRate: user.total > 0 ? Math.round((user.completed / user.total) * 100) : 0,
        averageRating: user.ratings.length > 0 ? 
          Math.round((user.ratings.reduce((sum, r) => sum + r, 0) / user.ratings.length) * 10) / 10 : 0,
        totalRated: user.ratings.length
      }))
      .filter(user => user.total > 0)
      .sort((a, b) => {
        // Sort by completion rate, then by average rating
        if (a.completionRate !== b.completionRate) {
          return b.completionRate - a.completionRate;
        }
        return b.averageRating - a.averageRating;
      })
      .slice(0, 10);

    // Daily completion trend (last 30 days)
    const dailyStats = {};
    const last30Days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      last30Days.push(dateStr);
      dailyStats[dateStr] = { total: 0, completed: 0 };
    }

    tasks.forEach(task => {
      if (dailyStats[task.date]) {
        dailyStats[task.date].total++;
        if (task.status === 'completed') {
          dailyStats[task.date].completed++;
        }
      }
    });

    const completionTrend = last30Days.map(date => ({
      date,
      total: dailyStats[date].total,
      completed: dailyStats[date].completed,
      completionRate: dailyStats[date].total > 0 ? 
        Math.round((dailyStats[date].completed / dailyStats[date].total) * 100) : 0
    }));

    res.status(200).json({
      success: true,
      period,
      analytics: {
        overview: {
          totalTasks,
          completedTasks: completedTasks.length,
          completionRate,
          averageRating,
          totalRated: ratedTasks.length
        },
        categoryStats,
        topPerformers,
        completionTrend
      }
    });

  } catch (error) {
    console.error("Get task analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch task analytics"
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

    // Validate assignedTo if being updated
    if (updates.assignedTo) {
      const user = await User.findById(updates.assignedTo);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Assigned user not found"
        });
      }
    }

    // Update task
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        task[key] = updates[key];
      }
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
        category: task.category,
        assignedTo: task.assignedTo
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
    const { month, year, period = 'month' } = req.query;

    let query = { assignedTo: userId };
    
    // Filter by month/year if provided
    if (month && year) {
      const startDate = `${year}-${month.padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      query.date = { $gte: startDate, $lte: endDate };
    } else {
      // Use period for date range
      const now = new Date();
      let daysBack = 30;
      
      switch (period) {
        case 'week':
          daysBack = 7;
          break;
        case 'quarter':
          daysBack = 90;
          break;
        case 'year':
          daysBack = 365;
          break;
      }
      
      const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
      query.date = { $gte: startDate.toISOString().split('T')[0] };
    }

    const tasks = await Task.find(query).sort({ date: -1 });

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
    const ratedTasks = tasks.filter(t => t.rating && t.status === 'completed');
    if (ratedTasks.length > 0) {
      const totalRating = ratedTasks.reduce((sum, task) => sum + task.rating, 0);
      performance.averageRating = Math.round((totalRating / ratedTasks.length) * 10) / 10;
    }

    // Performance by category
    const categoryPerformance = {};
    tasks.forEach(task => {
      if (!categoryPerformance[task.category]) {
        categoryPerformance[task.category] = {
          total: 0,
          completed: 0,
          averageRating: 0,
          ratings: []
        };
      }
      categoryPerformance[task.category].total++;
      if (task.status === 'completed') {
        categoryPerformance[task.category].completed++;
        if (task.rating) {
          categoryPerformance[task.category].ratings.push(task.rating);
        }
      }
    });

    // Calculate category averages
    Object.keys(categoryPerformance).forEach(category => {
      const catData = categoryPerformance[category];
      catData.completionRate = catData.total > 0 ? 
        Math.round((catData.completed / catData.total) * 100) : 0;
      
      if (catData.ratings.length > 0) {
        const avgRating = catData.ratings.reduce((sum, r) => sum + r, 0) / catData.ratings.length;
        catData.averageRating = Math.round(avgRating * 10) / 10;
      }
      delete catData.ratings; // Remove temporary array
    });

    // Recent tasks for context
    const recentTasks = tasks.slice(0, 10);

    // Get user info
    const user = await User.findById(userId).select('username email department');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        department: user.department
      },
      period: {
        type: period,
        month: month || null,
        year: year || null
      },
      performance,
      categoryPerformance,
      recentTasks,
      totalRated: ratedTasks.length
    });

  } catch (error) {
    console.error("Get user performance error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user performance"
    });
  }
});

// 🔹 GET /api/tasks/categories - Get available task categories
router.get("/categories", authenticateToken, async (req, res) => {
  try {
    // Get distinct categories from existing tasks
    const categories = await Task.distinct('category');
    
    // You can also define default categories
    const defaultCategories = [
      'Security',
      'Maintenance',
      'Cleaning',
      'Administrative',
      'Customer Service',
      'Inspection',
      'Training',
      'Emergency Response'
    ];

    // Combine and remove duplicates
    const allCategories = [...new Set([...defaultCategories, ...categories])];

    res.status(200).json({
      success: true,
      categories: allCategories.sort()
    });

  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories"
    });
  }
});

// 🔹 GET /api/tasks/stats - Get task statistics for current user
router.get("/stats", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'month' } = req.query;

    let dateQuery = {};
    const now = new Date();

    switch (period) {
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateQuery.date = { $gte: weekAgo.toISOString().split('T')[0] };
        break;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateQuery.date = { $gte: monthAgo.toISOString().split('T')[0] };
        break;
      case 'quarter':
        const quarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        dateQuery.date = { $gte: quarterAgo.toISOString().split('T')[0] };
        break;
    }

    const tasks = await Task.find({ 
      assignedTo: userId,
      ...dateQuery 
    });

    const stats = {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length
    };

    stats.completionRate = stats.total > 0 ? 
      Math.round((stats.completed / stats.total) * 100) : 0;

    // Average rating
    const ratedTasks = tasks.filter(t => t.rating && t.status === 'completed');
    stats.averageRating = ratedTasks.length > 0 ? 
      Math.round((ratedTasks.reduce((sum, t) => sum + t.rating, 0) / ratedTasks.length) * 10) / 10 : 0;

    // Tasks by priority
    const priorityStats = {
      low: tasks.filter(t => t.priority === 'low').length,
      medium: tasks.filter(t => t.priority === 'medium').length,
      high: tasks.filter(t => t.priority === 'high').length,
      urgent: tasks.filter(t => t.priority === 'urgent').length
    };

    // Tasks by category
    const categoryStats = {};
    tasks.forEach(task => {
      categoryStats[task.category] = (categoryStats[task.category] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      period,
      stats,
      priorityStats,
      categoryStats,
      totalRated: ratedTasks.length
    });

  } catch (error) {
    console.error("Get task stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch task statistics"
    });
  }
});

// 🔹 POST /api/tasks/bulk-update-status - Bulk update task status (admin only)
router.post("/bulk-update-status", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { taskIds, status, completionNotes } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Task IDs array is required"
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required"
      });
    }

    const validStatuses = ['pending', 'in-progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }

    const updateData = { status };
    if (completionNotes) {
      updateData.completionNotes = completionNotes;
    }

    // Set completion time if completed
    if (status === 'completed') {
      updateData.completedAt = new Date();
    } else if (status !== 'completed') {
      updateData.completedAt = null;
    }

    const result = await Task.updateMany(
      { _id: { $in: taskIds } },
      updateData
    );

    const updatedTasks = await Task.find({ _id: { $in: taskIds } })
      .populate('assignedTo', 'username email')
      .populate('assignedBy', 'username email');

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} tasks updated to ${status}`,
      modifiedCount: result.modifiedCount,
      tasks: updatedTasks
    });

  } catch (error) {
    console.error("Bulk update status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update task statuses"
    });
  }
});

// 🔹 GET /api/tasks/:taskId - Get specific task details
router.get("/:taskId", authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    const task = await Task.findById(taskId)
      .populate('assignedTo', 'username email department')
      .populate('assignedBy', 'username email')
      .populate('ratedBy', 'username email');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found"
      });
    }

    // Check if user can view this task (assigned user or admin)
    if (!isAdmin && task.assignedTo._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only view tasks assigned to you"
      });
    }

    res.status(200).json({
      success: true,
      task
    });

  } catch (error) {
    console.error("Get task details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch task details"
    });
  }
});

module.exports = router;