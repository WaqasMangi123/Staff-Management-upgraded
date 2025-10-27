const mongoose = require("mongoose");

const performanceSchema = new mongoose.Schema({
  // User reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Time period (format: YYYY-MM)
  month: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^\d{4}-\d{2}$/.test(v);
      },
      message: "Month must be in YYYY-MM format"
    }
  },

  // Attendance Metrics
  attendanceScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  punctualityScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  totalWorkingHours: {
    type: Number,
    default: 0,
    min: 0
  },
  totalWorkDays: {
    type: Number,
    default: 0,
    min: 0
  },
  presentDays: {
    type: Number,
    default: 0,
    min: 0
  },
  lateArrivals: {
    type: Number,
    default: 0,
    min: 0
  },
  absences: {
    type: Number,
    default: 0,
    min: 0
  },
  approvedLeaves: {
    type: Number,
    default: 0,
    min: 0
  },

  // Task Performance Metrics
  taskCompletionRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  averageTaskRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalTasks: {
    type: Number,
    default: 0,
    min: 0
  },
  completedTasks: {
    type: Number,
    default: 0,
    min: 0
  },
  pendingTasks: {
    type: Number,
    default: 0,
    min: 0
  },
  inProgressTasks: {
    type: Number,
    default: 0,
    min: 0
  },
  cancelledTasks: {
    type: Number,
    default: 0,
    min: 0
  },

  // Overall Performance Score (calculated field)
  overallScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },

  // Performance Grade (A, B, C, D, F)
  grade: {
    type: String,
    enum: ['A+', 'A', 'B', 'C', 'D', 'F'],
    default: 'F'
  },

  // Performance Level Classification
  performanceLevel: {
    type: String,
    enum: ['excellent', 'good', 'satisfactory', 'needs_improvement', 'poor'],
    default: 'poor'
  },

  // Supervisor Feedback
  supervisorRating: {
    type: Number,
    min: 1,
    max: 5
  },
  supervisorComments: {
    type: String,
    maxlength: 1000
  },
  ratedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  ratedAt: {
    type: Date
  },

  // Performance Review Integration
  hasActiveReview: {
    type: Boolean,
    default: false
  },
  lastReviewDate: {
    type: Date
  },
  reviewsCount: {
    type: Number,
    default: 0
  },
  warningsCount: {
    type: Number,
    default: 0
  },
  
  // Warning Flags
  hasActiveWarnings: {
    type: Boolean,
    default: false
  },
  warningLevel: {
    type: String,
    enum: ['none', 'first_warning', 'second_warning', 'final_warning'],
    default: 'none'
  },
  lastWarningDate: {
    type: Date
  },

  // Performance Issues Tracking
  performanceIssues: [{
    category: {
      type: String,
      enum: ['attendance', 'punctuality', 'task_completion', 'quality', 'behavior', 'other'],
      required: true
    },
    description: {
      type: String,
      required: true,
      maxlength: 500
    },
    severity: {
      type: String,
      enum: ['minor', 'moderate', 'major', 'critical'],
      default: 'moderate'
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reportedAt: {
      type: Date,
      default: Date.now
    },
    resolved: {
      type: Boolean,
      default: false
    },
    resolvedAt: Date,
    resolutionNotes: String
  }],

  // Achievements for the month
  achievements: [{
    title: {
      type: String,
      required: true,
      maxlength: 100
    },
    description: {
      type: String,
      maxlength: 500
    },
    category: {
      type: String,
      enum: ['performance', 'attendance', 'teamwork', 'innovation', 'customer_service', 'leadership'],
      default: 'performance'
    },
    points: {
      type: Number,
      default: 0,
      min: 0
    },
    date: {
      type: Date,
      default: Date.now
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // Areas for improvement
  areas_for_improvement: [{
    area: {
      type: String,
      required: true,
      maxlength: 100
    },
    description: {
      type: String,
      maxlength: 500
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    targetDate: Date,
    progress: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed', 'on_hold'],
      default: 'not_started'
    },
    progressNotes: String,
    date: {
      type: Date,
      default: Date.now
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }],

  // Training recommendations
  trainingRecommendations: [{
    title: {
      type: String,
      required: true
    },
    description: String,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    category: {
      type: String,
      enum: ['technical', 'soft_skills', 'leadership', 'compliance', 'safety', 'other'],
      default: 'technical'
    },
    estimatedDuration: String, // e.g., "2 hours", "1 day"
    estimatedCost: Number,
    provider: String,
    dueDate: Date,
    status: {
      type: String,
      enum: ['recommended', 'approved', 'in_progress', 'completed', 'cancelled'],
      default: 'recommended'
    },
    completedAt: Date,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Performance trends
  trend: {
    attendance: {
      type: String,
      enum: ['improving', 'declining', 'stable'],
      default: 'stable'
    },
    tasks: {
      type: String,
      enum: ['improving', 'declining', 'stable'],
      default: 'stable'
    },
    punctuality: {
      type: String,
      enum: ['improving', 'declining', 'stable'],
      default: 'stable'
    },
    overall: {
      type: String,
      enum: ['improving', 'declining', 'stable'],
      default: 'stable'
    }
  },

  // Recognition and awards
  recognitions: [{
    type: {
      type: String,
      enum: ['employee_of_month', 'perfect_attendance', 'high_performer', 'team_player', 'innovation', 'customer_service', 'improvement_award'],
      required: true
    },
    title: {
      type: String,
      required: true
    },
    description: String,
    points: {
      type: Number,
      default: 0
    },
    monetaryValue: Number,
    awardedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    awardedAt: {
      type: Date,
      default: Date.now
    },
    publiclyAnnounced: {
      type: Boolean,
      default: false
    }
  }],

  // Goals for next period
  goals: [{
    title: {
      type: String,
      required: true
    },
    description: String,
    category: {
      type: String,
      enum: ['attendance', 'productivity', 'quality', 'skills', 'behavior', 'other'],
      default: 'productivity'
    },
    target: Number, // target percentage or number
    currentProgress: {
      type: Number,
      default: 0
    },
    deadline: Date,
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed', 'overdue', 'cancelled'],
      default: 'not_started'
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    milestones: [{
      description: String,
      targetDate: Date,
      completed: {
        type: Boolean,
        default: false
      },
      completedAt: Date
    }],
    setBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    setAt: {
      type: Date,
      default: Date.now
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }],

  // Disciplinary Actions
  disciplinaryActions: [{
    type: {
      type: String,
      enum: ['verbal_warning', 'written_warning', 'suspension', 'final_warning', 'termination'],
      required: true
    },
    reason: {
      type: String,
      required: true,
      maxlength: 1000
    },
    description: {
      type: String,
      maxlength: 2000
    },
    effectiveDate: {
      type: Date,
      default: Date.now
    },
    expiryDate: Date, // For warnings that expire
    isActive: {
      type: Boolean,
      default: true
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    acknowledgedByEmployee: {
      type: Boolean,
      default: false
    },
    acknowledgedAt: Date,
    employeeComments: {
      type: String,
      maxlength: 1000
    }
  }],

  // Performance Improvement Plan (PIP)
  improvementPlan: {
    isActive: {
      type: Boolean,
      default: false
    },
    startDate: Date,
    endDate: Date,
    objectives: [{
      description: String,
      targetDate: Date,
      completed: {
        type: Boolean,
        default: false
      },
      completedAt: Date,
      notes: String
    }],
    meetingSchedule: [{
      date: Date,
      completed: {
        type: Boolean,
        default: false
      },
      notes: String,
      attendees: [String]
    }],
    finalOutcome: {
      type: String,
      enum: ['successful', 'unsuccessful', 'extended', 'cancelled'],
    },
    finalNotes: String,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },

  // Calculation metadata
  calculatedAt: {
    type: Date,
    default: Date.now
  },
  calculatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isManualEntry: {
    type: Boolean,
    default: false
  },
  
  // Notes from supervisor/HR
  notes: {
    type: String,
    maxlength: 2000
  },

  // Status
  status: {
    type: String,
    enum: ['draft', 'finalized', 'reviewed', 'under_review', 'needs_attention'],
    default: 'draft'
  },

  // Review status
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  reviewNotes: {
    type: String,
    maxlength: 1000
  },

  // Alert and Notification Flags
  alerts: {
    lowPerformance: {
      type: Boolean,
      default: false
    },
    attendanceIssue: {
      type: Boolean,
      default: false
    },
    taskDelay: {
      type: Boolean,
      default: false
    },
    improvementRequired: {
      type: Boolean,
      default: false
    },
    reviewDue: {
      type: Boolean,
      default: false
    }
  },

  // Historical Data
  previousMonthComparison: {
    attendanceChange: Number, // percentage change
    taskChange: Number,
    punctualityChange: Number,
    overallChange: Number
  },

  // Manager/Supervisor specific fields
  managerApproval: {
    approved: {
      type: Boolean,
      default: false
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    comments: String
  },

  // HR Review fields
  hrReview: {
    reviewed: {
      type: Boolean,
      default: false
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: Date,
    actionRequired: {
      type: Boolean,
      default: false
    },
    actionNotes: String
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create compound index for efficient queries
performanceSchema.index({ userId: 1, month: 1 }, { unique: true });
performanceSchema.index({ month: 1 });
performanceSchema.index({ overallScore: -1 });
performanceSchema.index({ grade: 1 });
performanceSchema.index({ calculatedAt: -1 });
performanceSchema.index({ performanceLevel: 1 });
performanceSchema.index({ warningLevel: 1 });
performanceSchema.index({ hasActiveWarnings: 1 });
performanceSchema.index({ status: 1 });

// Virtual for formatted month display
performanceSchema.virtual('monthDisplay').get(function() {
  const [year, month] = this.month.split('-');
  const date = new Date(year, month - 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
});

// Virtual for performance level based on overall score
performanceSchema.virtual('performanceLevelText').get(function() {
  if (this.overallScore >= 90) return 'Excellent';
  if (this.overallScore >= 80) return 'Good';
  if (this.overallScore >= 70) return 'Satisfactory';
  if (this.overallScore >= 60) return 'Needs Improvement';
  return 'Poor';
});

// Virtual for risk level
performanceSchema.virtual('riskLevel').get(function() {
  if (this.overallScore < 50 || this.warningsCount >= 3) return 'high';
  if (this.overallScore < 70 || this.warningsCount >= 2) return 'medium';
  if (this.overallScore < 85 || this.warningsCount >= 1) return 'low';
  return 'none';
});

// Virtual for active issues count
performanceSchema.virtual('activeIssuesCount').get(function() {
  return this.performanceIssues ? this.performanceIssues.filter(issue => !issue.resolved).length : 0;
});

// Virtual for completion percentage of goals
performanceSchema.virtual('goalsCompletionRate').get(function() {
  if (!this.goals || this.goals.length === 0) return 0;
  const completedGoals = this.goals.filter(goal => goal.status === 'completed').length;
  return Math.round((completedGoals / this.goals.length) * 100);
});

// Calculate overall score before saving
performanceSchema.pre('save', function(next) {
  // Calculate overall score (weighted average)
  const attendanceWeight = 0.4;
  const taskWeight = 0.4;
  const punctualityWeight = 0.2;
  
  this.overallScore = Math.round(
    (this.attendanceScore * attendanceWeight) +
    (this.taskCompletionRate * taskWeight) +
    (this.punctualityScore * punctualityWeight)
  );
  
  // Determine grade based on overall score
  if (this.overallScore >= 95) this.grade = 'A+';
  else if (this.overallScore >= 90) this.grade = 'A';
  else if (this.overallScore >= 80) this.grade = 'B';
  else if (this.overallScore >= 70) this.grade = 'C';
  else if (this.overallScore >= 60) this.grade = 'D';
  else this.grade = 'F';
  
  // Set performance level
  if (this.overallScore >= 90) this.performanceLevel = 'excellent';
  else if (this.overallScore >= 80) this.performanceLevel = 'good';
  else if (this.overallScore >= 70) this.performanceLevel = 'satisfactory';
  else if (this.overallScore >= 60) this.performanceLevel = 'needs_improvement';
  else this.performanceLevel = 'poor';

  // Set alert flags
  this.alerts.lowPerformance = this.overallScore < 70;
  this.alerts.attendanceIssue = this.attendanceScore < 80;
  this.alerts.taskDelay = this.taskCompletionRate < 75;
  this.alerts.improvementRequired = this.overallScore < 60 || this.warningsCount > 0;

  // Update status based on performance
  if (this.overallScore < 50 || this.warningsCount >= 2) {
    this.status = 'needs_attention';
  } else if (this.status === 'draft' && this.overallScore > 0) {
    this.status = 'finalized';
  }
  
  next();
});

// Instance methods
performanceSchema.methods.calculateTrends = function(previousMonth) {
  if (!previousMonth) return;
  
  // Calculate attendance trend
  const attendanceDiff = this.attendanceScore - previousMonth.attendanceScore;
  if (attendanceDiff > 5) this.trend.attendance = 'improving';
  else if (attendanceDiff < -5) this.trend.attendance = 'declining';
  else this.trend.attendance = 'stable';
  
  // Calculate task trend
  const taskDiff = this.taskCompletionRate - previousMonth.taskCompletionRate;
  if (taskDiff > 5) this.trend.tasks = 'improving';
  else if (taskDiff < -5) this.trend.tasks = 'declining';
  else this.trend.tasks = 'stable';
  
  // Calculate punctuality trend
  const punctualityDiff = this.punctualityScore - previousMonth.punctualityScore;
  if (punctualityDiff > 5) this.trend.punctuality = 'improving';
  else if (punctualityDiff < -5) this.trend.punctuality = 'declining';
  else this.trend.punctuality = 'stable';

  // Calculate overall trend
  const overallDiff = this.overallScore - previousMonth.overallScore;
  if (overallDiff > 5) this.trend.overall = 'improving';
  else if (overallDiff < -5) this.trend.overall = 'declining';
  else this.trend.overall = 'stable';

  // Store comparison data
  this.previousMonthComparison = {
    attendanceChange: Math.round(attendanceDiff * 10) / 10,
    taskChange: Math.round(taskDiff * 10) / 10,
    punctualityChange: Math.round(punctualityDiff * 10) / 10,
    overallChange: Math.round(overallDiff * 10) / 10
  };
};

performanceSchema.methods.addAchievement = function(title, description, category, points, addedBy) {
  this.achievements.push({
    title,
    description,
    category: category || 'performance',
    points: points || 0,
    addedBy,
    date: new Date()
  });
  return this.save();
};

performanceSchema.methods.addImprovementArea = function(area, description, priority, targetDate, addedBy) {
  this.areas_for_improvement.push({
    area,
    description,
    priority: priority || 'medium',
    targetDate,
    addedBy,
    date: new Date(),
    lastUpdated: new Date()
  });
  return this.save();
};

performanceSchema.methods.addGoal = function(title, description, category, target, deadline, priority, setBy) {
  this.goals.push({
    title,
    description,
    category: category || 'productivity',
    target,
    deadline,
    priority: priority || 'medium',
    setBy,
    setAt: new Date(),
    lastUpdated: new Date()
  });
  return this.save();
};

performanceSchema.methods.addPerformanceIssue = function(category, description, severity, reportedBy) {
  this.performanceIssues.push({
    category,
    description,
    severity: severity || 'moderate',
    reportedBy,
    reportedAt: new Date()
  });
  this.status = 'under_review';
  return this.save();
};

performanceSchema.methods.resolveIssue = function(issueId, resolutionNotes) {
  const issue = this.performanceIssues.id(issueId);
  if (issue) {
    issue.resolved = true;
    issue.resolvedAt = new Date();
    issue.resolutionNotes = resolutionNotes;
  }
  return this.save();
};

performanceSchema.methods.addDisciplinaryAction = function(type, reason, description, issuedBy, expiryDate) {
  this.disciplinaryActions.push({
    type,
    reason,
    description,
    issuedBy,
    expiryDate,
    effectiveDate: new Date()
  });

  // Update warning counts and level
  if (['verbal_warning', 'written_warning', 'final_warning'].includes(type)) {
    this.warningsCount += 1;
    this.hasActiveWarnings = true;
    
    if (type === 'final_warning' || this.warningsCount >= 3) {
      this.warningLevel = 'final_warning';
    } else if (this.warningsCount >= 2) {
      this.warningLevel = 'second_warning';
    } else {
      this.warningLevel = 'first_warning';
    }
  }

  this.lastWarningDate = new Date();
  this.status = 'needs_attention';
  
  return this.save();
};

performanceSchema.methods.createImprovementPlan = function(objectives, duration, createdBy) {
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + (duration || 3)); // Default 3 months

  this.improvementPlan = {
    isActive: true,
    startDate: new Date(),
    endDate: endDate,
    objectives: objectives.map(obj => ({
      description: obj.description,
      targetDate: obj.targetDate || endDate
    })),
    createdBy
  };

  return this.save();
};

performanceSchema.methods.getPerformanceSummary = function() {
  return {
    userId: this.userId,
    month: this.month,
    overallScore: this.overallScore,
    grade: this.grade,
    performanceLevel: this.performanceLevel,
    attendanceScore: this.attendanceScore,
    taskCompletionRate: this.taskCompletionRate,
    punctualityScore: this.punctualityScore,
    hasActiveWarnings: this.hasActiveWarnings,
    warningLevel: this.warningLevel,
    activeIssuesCount: this.activeIssuesCount,
    goalsCompletionRate: this.goalsCompletionRate,
    riskLevel: this.riskLevel,
    status: this.status
  };
};

// Static methods
performanceSchema.statics.getTopPerformers = function(month, limit = 10) {
  return this.find({ 
    month,
    status: { $in: ['finalized', 'reviewed'] }
  })
    .sort({ overallScore: -1 })
    .limit(limit)
    .populate('userId', 'username email')
    .populate('ratedBy', 'username');
};

performanceSchema.statics.getLowPerformers = function(month, threshold = 60) {
  return this.find({
    month,
    overallScore: { $lt: threshold },
    status: { $in: ['finalized', 'reviewed', 'needs_attention'] }
  })
    .sort({ overallScore: 1 })
    .populate('userId', 'username email');
};

performanceSchema.statics.getEmployeesNeedingAttention = function(month) {
  return this.find({
    month,
    $or: [
      { hasActiveWarnings: true },
      { overallScore: { $lt: 60 } },
      { status: 'needs_attention' },
      { 'alerts.improvementRequired': true }
    ]
  })
    .sort({ overallScore: 1 })
    .populate('userId', 'username email');
};

performanceSchema.statics.getDepartmentAverages = async function(month) {
  return await this.aggregate([
    { $match: { month, status: { $in: ['finalized', 'reviewed'] } } },
    {
      $lookup: {
        from: 'userprofiles',
        localField: 'userId',
        foreignField: 'userId',
        as: 'profile'
      }
    },
    { $unwind: '$profile' },
    {
      $group: {
        _id: '$profile.department',
        averageAttendance: { $avg: '$attendanceScore' },
        averageTaskCompletion: { $avg: '$taskCompletionRate' },
        averagePunctuality: { $avg: '$punctualityScore' },
        averageOverall: { $avg: '$overallScore' },
        employeeCount: { $sum: 1 },
        topScore: { $max: '$overallScore' },
        lowScore: { $min: '$overallScore' },
        warningsCount: { $sum: '$warningsCount' },
        improvementPlansCount: { $sum: { $cond: ['$improvementPlan.isActive', 1, 0] } }
      }
    },
    {
      $project: {
        department: '$_id',
        averageAttendance: { $round: ['$averageAttendance', 1] },
        averageTaskCompletion: { $round: ['$averageTaskCompletion', 1] },
        averagePunctuality: { $round: ['$averagePunctuality', 1] },
        averageOverall: { $round: ['$averageOverall', 1] },
        employeeCount: 1,
        topScore: 1,
        lowScore: 1,
        warningsCount: 1,
        improvementPlansCount: 1,
        _id: 0
      }
    },
    { $sort: { averageOverall: -1 } }
  ]);
};

performanceSchema.statics.getMonthlyTrends = function(userId, months = 6) {
  const currentDate = new Date();
  const monthsArray = [];
  
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const monthString = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    monthsArray.push(monthString);
  }
  
  return this.find({
    userId,
    month: { $in: monthsArray }
  }).sort({ month: 1 });
};

performanceSchema.statics.getPerformanceAnalytics = async function(month) {
  const analytics = await this.aggregate([
    { $match: { month, status: { $in: ['finalized', 'reviewed'] } } },
    {
      $group: {
        _id: null,
        totalEmployees: { $sum: 1 },
        averageOverallScore: { $avg: '$overallScore' },
        excellentPerformers: { $sum: { $cond: [{ $gte: ['$overallScore', 90] }, 1, 0] } },
        goodPerformers: { $sum: { $cond: [{ $and: [{ $gte: ['$overallScore', 80] }, { $lt: ['$overallScore', 90] }] }, 1, 0] } },
        averagePerformers: { $sum: { $cond: [{ $and: [{ $gte: ['$overallScore', 70] }, { $lt: ['$overallScore', 80] }] }, 1, 0] } },
        belowAveragePerformers: { $sum: { $cond: [{ $and: [{ $gte: ['$overallScore', 60] }, { $lt: ['$overallScore', 70] }] }, 1, 0] } },
        poorPerformers: { $sum: { $cond: [{ $lt: ['$overallScore', 60] }, 1, 0] } },
        totalWarnings: { $sum: '$warningsCount' },
        employeesWithWarnings: { $sum: { $cond: ['$hasActiveWarnings', 1, 0] } },
        activeImprovementPlans: { $sum: { $cond: ['$improvementPlan.isActive', 1, 0] } }
      }
    }
  ]);

  return analytics[0] || {};
};

const Performance = mongoose.model("Performance", performanceSchema);

module.exports = Performance;