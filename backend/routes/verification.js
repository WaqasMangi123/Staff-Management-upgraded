const express = require("express");
const router = express.Router();
const { SecretTeam, VerificationTask } = require("../models/verification");
const Task = require("../models/task");
const User = require("../models/user");
const jwt = require("jsonwebtoken");

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: "Token required" });
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: "Invalid token" });
    req.user = user;
    next();
  });
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ success: false, message: "Admin only" });
  }
  next();
};

// Generate unique team code
const generateCode = async () => {
  let teamCode;
  let exists = true;
  
  while (exists) {
    teamCode = 'ST' + Math.floor(100 + Math.random() * 900);
    exists = await SecretTeam.findOne({ teamCode });
  }
  
  return teamCode;
};

// Helper: Select team with least workload
const selectBestTeam = async () => {
  const activeTeams = await SecretTeam.find({ isActive: true });
  if (activeTeams.length === 0) return null;

  const teamsWithWorkload = await Promise.all(
    activeTeams.map(async (team) => {
      const workload = await SecretTeam.getTeamWorkload(team._id);
      return { team, workload };
    })
  );

  return teamsWithWorkload.reduce((best, current) => 
    current.workload < best.workload ? current : best
  ).team;
};

// 🔹 1. CREATE SECRET TEAM (Admin)
router.post("/create-team", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { teamName, memberIds } = req.body;

    if (!teamName || !memberIds || memberIds.length !== 3) {
      return res.status(400).json({ 
        success: false, 
        message: "Need team name and exactly 3 member IDs" 
      });
    }

    // Validate all users exist
    const users = await User.find({ _id: { $in: memberIds }, role: 'user' });
    if (users.length !== 3) {
      return res.status(400).json({ 
        success: false, 
        message: "Some users not found or not regular staff" 
      });
    }

    // Check if users are already in active teams
    const existingTeams = await SecretTeam.find({
      'members.userId': { $in: memberIds },
      isActive: true
    });

    if (existingTeams.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: "One or more users are already in an active team" 
      });
    }

    const teamCode = await generateCode();
    const newTeam = new SecretTeam({
      teamName: teamName.trim(),
      teamCode,
      members: memberIds.map(userId => ({ userId })),
      createdBy: req.user.id
    });

    await newTeam.save();
    await newTeam.populate('members.userId', 'username email');

    res.json({
      success: true,
      message: "Secret verification team created successfully",
      team: { 
        id: newTeam._id,
        teamName: newTeam.teamName, 
        teamCode: newTeam.teamCode, 
        members: newTeam.members.map(m => ({
          id: m.userId._id,
          username: m.userId.username
        }))
      }
    });

  } catch (error) {
    console.error("Create team error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Failed to create team" 
    });
  }
});

// 🔹 2. ASSIGN VERIFICATION (Auto when task completed)
router.post("/assign-verification", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { taskId } = req.body;

    if (!taskId) {
      return res.status(400).json({ success: false, message: "Task ID required" });
    }

    const task = await Task.findById(taskId);
    if (!task || task.status !== 'completed') {
      return res.status(400).json({ 
        success: false, 
        message: "Task must be completed" 
      });
    }

    // Check if verification already exists
    const existingVerification = await VerificationTask.findOne({ taskId });
    if (existingVerification) {
      return res.status(400).json({ 
        success: false, 
        message: "Verification already assigned for this task" 
      });
    }

    // Select team with least workload
    const selectedTeam = await selectBestTeam();
    if (!selectedTeam) {
      return res.status(400).json({ 
        success: false, 
        message: "No active teams available" 
      });
    }

    // Pick random active member from selected team
    const activeMembers = selectedTeam.members.filter(m => m.isActive);
    const randomMember = activeMembers[Math.floor(Math.random() * activeMembers.length)];
    
    // Set 24hr deadline
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + 24);

    const verification = new VerificationTask({
      taskId,
      originalStaffId: task.assignedTo,
      assignedVerifier: randomMember.userId,
      assignedTeam: selectedTeam._id,
      location: task.location,
      deadline,
      priority: task.priority === 'urgent' ? 'urgent' : 'medium'
    });

    await verification.save();

    res.json({
      success: true,
      message: "Verification assigned to secret team",
      verification: {
        id: verification._id,
        teamCode: selectedTeam.teamCode,
        deadline: verification.deadline
      }
    });

  } catch (error) {
    console.error("Assign verification error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to assign verification" 
    });
  }
});

// 🔹 3. GET MY VERIFICATION TASKS (Secret member)
router.get("/my-tasks", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    // Check if user is in any secret team
    const userTeam = await SecretTeam.findOne({
      'members.userId': userId,
      'members.isActive': true,
      isActive: true
    });

    if (!userTeam) {
      return res.json({
        success: true,
        isVerifier: false,
        message: "You are not part of any verification team",
        tasks: []
      });
    }

    let query = { assignedVerifier: userId };
    if (status) query.verificationStatus = status;

    const tasks = await VerificationTask.find(query)
      .populate('taskId', 'title description category priority')
      .populate('assignedTeam', 'teamCode')
      .sort({ assignedAt: -1 });

    const formattedTasks = tasks.map(t => ({
      id: t._id,
      taskTitle: t.taskId?.title || 'Unknown Task',
      category: t.taskId?.category || 'General',
      priority: t.priority,
      location: t.location,
      status: t.verificationStatus,
      result: t.verificationResult,
      overallScore: t.overallScore,
      deadline: t.deadline,
      assignedAt: t.assignedAt,
      isOverdue: t.isOverdue(),
      teamCode: userTeam.teamCode
    }));

    res.json({
      success: true,
      isVerifier: true,
      teamCode: userTeam.teamCode,
      tasks: formattedTasks,
      summary: {
        total: formattedTasks.length,
        pending: formattedTasks.filter(t => t.status === 'pending').length,
        overdue: formattedTasks.filter(t => t.isOverdue).length,
        completed: formattedTasks.filter(t => t.status === 'completed').length
      }
    });

  } catch (error) {
    console.error("Get my tasks error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to get verification tasks" 
    });
  }
});

// 🔹 4. SUBMIT VERIFICATION REPORT (Secret member)
router.put("/submit/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { cleanliness, completeness, quality, comments, issues } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!cleanliness || !completeness || !quality) {
      return res.status(400).json({ 
        success: false, 
        message: "All ratings required (1-5 whole numbers)" 
      });
    }

    const ratings = [cleanliness, completeness, quality];
    if (ratings.some(r => !Number.isInteger(r) || r < 1 || r > 5)) {
      return res.status(400).json({ 
        success: false, 
        message: "All ratings must be whole numbers between 1 and 5" 
      });
    }

    const verification = await VerificationTask.findById(id)
      .populate('taskId', 'title');

    if (!verification) {
      return res.status(404).json({ 
        success: false, 
        message: "Verification task not found" 
      });
    }

    if (verification.assignedVerifier.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: "You can only submit reports for tasks assigned to you" 
      });
    }

    if (verification.verificationStatus === 'completed') {
      return res.status(400).json({ 
        success: false, 
        message: "Verification report already submitted" 
      });
    }

    // Update verification with ratings
    verification.cleanliness = parseInt(cleanliness);
    verification.completeness = parseInt(completeness);
    verification.quality = parseInt(quality);
    verification.comments = (comments || '').trim();
    
    // Add issues if provided
    if (issues && Array.isArray(issues)) {
      verification.issues = issues.map(issue => ({
        category: issue.category,
        description: issue.description.trim(),
        severity: issue.severity || 'medium'
      }));
    }

    verification.verificationStatus = 'completed';
    verification.verifiedAt = new Date();

    await verification.save();

    res.json({
      success: true,
      message: "Verification report submitted successfully",
      result: {
        taskTitle: verification.taskId?.title,
        overallScore: verification.overallScore,
        verificationResult: verification.verificationResult,
        breakdown: {
          cleanliness: verification.cleanliness,
          completeness: verification.completeness,
          quality: verification.quality
        }
      }
    });

  } catch (error) {
    console.error("Submit verification error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Failed to submit verification report" 
    });
  }
});

// 🔹 5. ENHANCED ADMIN DASHBOARD
router.get("/dashboard", authenticateToken, adminOnly, async (req, res) => {
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

    const allVerifications = await VerificationTask.find({
      assignedAt: { $gte: startDate }
    })
    .populate('taskId', 'title category priority')
    .populate('originalStaffId', 'username')
    .populate('assignedTeam', 'teamName teamCode')
    .sort({ assignedAt: -1 });

    // Calculate comprehensive stats
    const stats = {
      total: allVerifications.length,
      pending: allVerifications.filter(v => v.verificationStatus === 'pending').length,
      inProgress: allVerifications.filter(v => v.verificationStatus === 'in-progress').length,
      completed: allVerifications.filter(v => v.verificationStatus === 'completed').length,
      overdue: allVerifications.filter(v => v.isOverdue()).length,
      
      // Results breakdown
      passed: allVerifications.filter(v => v.verificationResult === 'pass').length,
      failed: allVerifications.filter(v => v.verificationResult === 'fail').length,
      recheck: allVerifications.filter(v => v.verificationResult === 'recheck').length,
      
      // Average scores
      avgScore: 0,
      avgCleanliness: 0,
      avgCompleteness: 0,
      avgQuality: 0
    };

    // Calculate averages
    const completedTasks = allVerifications.filter(v => v.overallScore);
    if (completedTasks.length > 0) {
      stats.avgScore = Math.round(
        (completedTasks.reduce((sum, v) => sum + v.overallScore, 0) / completedTasks.length) * 10
      ) / 10;
      
      stats.avgCleanliness = Math.round(
        (completedTasks.reduce((sum, v) => sum + v.cleanliness, 0) / completedTasks.length) * 10
      ) / 10;
      
      stats.avgCompleteness = Math.round(
        (completedTasks.reduce((sum, v) => sum + v.completeness, 0) / completedTasks.length) * 10
      ) / 10;
      
      stats.avgQuality = Math.round(
        (completedTasks.reduce((sum, v) => sum + v.quality, 0) / completedTasks.length) * 10
      ) / 10;
    }

    // Performance by category
    const categoryStats = {};
    allVerifications.forEach(v => {
      if (v.taskId?.category) {
        const cat = v.taskId.category;
        if (!categoryStats[cat]) {
          categoryStats[cat] = { total: 0, pass: 0, fail: 0, recheck: 0, avgScore: 0, scores: [] };
        }
        categoryStats[cat].total++;
        if (v.verificationResult) {
          categoryStats[cat][v.verificationResult]++;
        }
        if (v.overallScore) {
          categoryStats[cat].scores.push(v.overallScore);
        }
      }
    });

    // Calculate category averages
    Object.keys(categoryStats).forEach(cat => {
      const scores = categoryStats[cat].scores;
      if (scores.length > 0) {
        categoryStats[cat].avgScore = Math.round(
          (scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10
        ) / 10;
      }
      delete categoryStats[cat].scores;
    });

    const recentTasks = allVerifications.slice(0, 15).map(v => ({
      id: v._id,
      taskTitle: v.taskId?.title || 'Unknown',
      category: v.taskId?.category || 'General',
      staff: v.originalStaffId?.username || 'Unknown',
      team: v.assignedTeam?.teamCode || 'Unknown',
      result: v.verificationResult,
      score: v.overallScore,
      status: v.verificationStatus,
      isOverdue: v.isOverdue(),
      verifiedAt: v.verifiedAt,
      issues: v.issues?.length || 0
    }));

    res.json({
      success: true,
      period,
      stats,
      categoryStats,
      recentTasks,
      summary: {
        passRate: stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0,
        completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
        overdueRate: stats.total > 0 ? Math.round((stats.overdue / stats.total) * 100) : 0
      }
    });

  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to get verification dashboard" 
    });
  }
});

// 🔹 6. GET ALL TEAMS (Admin)
router.get("/teams", authenticateToken, adminOnly, async (req, res) => {
  try {
    const teams = await SecretTeam.find()
      .populate('members.userId', 'username email')
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 });

    const teamsWithStats = await Promise.all(
      teams.map(async (team) => {
        const totalTasks = await VerificationTask.countDocuments({ assignedTeam: team._id });
        const pendingTasks = await VerificationTask.countDocuments({ 
          assignedTeam: team._id, 
          verificationStatus: { $in: ['pending', 'in-progress'] } 
        });

        return {
          id: team._id,
          teamName: team.teamName,
          teamCode: team.teamCode,
          isActive: team.isActive,
          memberCount: team.members.length,
          members: team.members.map(m => ({
            id: m.userId._id,
            username: m.userId.username,
            email: m.userId.email,
            assignedAt: m.assignedAt,
            isActive: m.isActive
          })),
          stats: {
            totalTasks,
            pendingTasks,
            completedTasks: totalTasks - pendingTasks
          },
          createdBy: team.createdBy?.username || 'Unknown',
          createdAt: team.createdAt
        };
      })
    );

    res.json({
      success: true,
      teams: teamsWithStats,
      summary: {
        total: teams.length,
        active: teams.filter(t => t.isActive).length,
        inactive: teams.filter(t => !t.isActive).length
      }
    });

  } catch (error) {
    console.error("Get teams error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to get teams" 
    });
  }
});

// 🔹 7. GET OVERDUE VERIFICATIONS (Admin)
router.get("/overdue", authenticateToken, adminOnly, async (req, res) => {
  try {
    const overdueTasks = await VerificationTask.findOverdue()
      .populate('taskId', 'title category')
      .populate('originalStaffId', 'username')
      .populate('assignedVerifier', 'username')
      .populate('assignedTeam', 'teamName teamCode')
      .sort({ deadline: 1 });

    res.json({
      success: true,
      overdueTasks: overdueTasks.map(v => ({
        id: v._id,
        taskTitle: v.taskId?.title || 'Unknown',
        staff: v.originalStaffId?.username || 'Unknown',
        verifier: v.assignedVerifier?.username || 'Unknown',
        team: v.assignedTeam?.teamCode || 'Unknown',
        deadline: v.deadline,
        hoursOverdue: Math.floor((new Date() - v.deadline) / (1000 * 60 * 60)),
        location: v.location
      })),
      total: overdueTasks.length
    });

  } catch (error) {
    console.error("Get overdue error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to get overdue verifications" 
    });
  }
});

// 🔹 8. UPDATE TEAM STATUS (Admin)
router.put("/team/:id/status", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const team = await SecretTeam.findByIdAndUpdate(
      id,
      { isActive: Boolean(isActive) },
      { new: true }
    ).populate('members.userId', 'username');

    if (!team) {
      return res.status(404).json({ 
        success: false, 
        message: "Team not found" 
      });
    }

    res.json({
      success: true,
      message: `Team ${isActive ? 'activated' : 'deactivated'} successfully`,
      team: {
        id: team._id,
        teamName: team.teamName,
        teamCode: team.teamCode,
        isActive: team.isActive
      }
    });

  } catch (error) {
    console.error("Update team status error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to update team status" 
    });
  }
});

module.exports = router;