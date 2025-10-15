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
      enum: ['low', 'medium', 'high'],
      default: 'medium'
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

  // Training recommendations
  trainingRecommendations: [{
    title: {
      type: String,
      required: true
    },
    description: String,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    estimatedDuration: String, // e.g., "2 hours", "1 day"
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
    }
  },

  // Recognition and awards
  recognitions: [{
    type: {
      type: String,
      enum: ['employee_of_month', 'perfect_attendance', 'high_performer', 'team_player', 'innovation', 'customer_service'],
      required: true
    },
    title: {
      type: String,
      required: true
    },
    description: String,
    awardedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    awardedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Goals for next period
  goals: [{
    title: {
      type: String,
      required: true
    },
    description: String,
    target: Number, // target percentage or number
    deadline: Date,
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed', 'overdue'],
      default: 'not_started'
    },
    setBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    setAt: {
      type: Date,
      default: Date.now
    }
  }],

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
    enum: ['draft', 'finalized', 'reviewed'],
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

// Virtual for formatted month display
performanceSchema.virtual('monthDisplay').get(function() {
  const [year, month] = this.month.split('-');
  const date = new Date(year, month - 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
});

// Virtual for performance level
performanceSchema.virtual('performanceLevel').get(function() {
  if (this.overallScore >= 90) return 'Excellent';
  if (this.overallScore >= 80) return 'Good';
  if (this.overallScore >= 70) return 'Satisfactory';
  if (this.overallScore >= 60) return 'Needs Improvement';
  return 'Poor';
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
};

performanceSchema.methods.addAchievement = function(title, description, addedBy) {
  this.achievements.push({
    title,
    description,
    addedBy,
    date: new Date()
  });
  return this.save();
};

performanceSchema.methods.addImprovementArea = function(area, description, priority, addedBy) {
  this.areas_for_improvement.push({
    area,
    description,
    priority: priority || 'medium',
    addedBy,
    date: new Date()
  });
  return this.save();
};

performanceSchema.methods.addGoal = function(title, description, target, deadline, setBy) {
  this.goals.push({
    title,
    description,
    target,
    deadline,
    setBy,
    setAt: new Date()
  });
  return this.save();
};

// Static methods
performanceSchema.statics.getTopPerformers = function(month, limit = 10) {
  return this.find({ month })
    .sort({ overallScore: -1 })
    .limit(limit)
    .populate('userId', 'username email')
    .populate('ratedBy', 'username');
};

performanceSchema.statics.getDepartmentAverages = async function(month) {
  return await this.aggregate([
    { $match: { month } },
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
        topScore: { $max: '$overallScore' }
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

const Performance = mongoose.model("Performance", performanceSchema);

module.exports = Performance;