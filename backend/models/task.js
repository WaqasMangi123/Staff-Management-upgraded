const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  originalAssignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // Store original assignee when auto-reassigned
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: [
      'Security',
      'Maintenance', 
      'Cleaning',
      'Administrative',
      'Customer Service',
      'Inspection',
      'Training',
      'Emergency Response'
    ],
    required: true
  },
  location: {
    type: String,
    required: true
  },
  estimatedDuration: {
    type: Number, // in minutes
    default: 60
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'cancelled', 'reassigned'],
    default: 'pending'
  },
  completedAt: {
    type: Date
  },
  completionNotes: {
    type: String,
    maxlength: 500
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  feedback: {
    type: String,
    maxlength: 300
  },
  ratedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  ratedAt: {
    type: Date
  },
  
  // 🔥 SIMPLE VERIFICATION SYSTEM FIELDS
  verificationStatus: {
    type: String,
    enum: ['none', 'pending_verification', 'completed'],
    default: 'none'
  },
  verifierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  verificationAssignedAt: {
    type: Date,
    default: null
  },
  verificationResult: {
    type: String,
    enum: ['pass', 'fail', 'recheck'],
    default: null
  },
  verificationScore: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  verificationNotes: {
    type: String,
    maxlength: 500,
    default: ''
  },
  verificationCompletedAt: {
    type: Date,
    default: null
  },
  finalVerificationStatus: {
    type: String,
    enum: ['approved', 'rejected', 'pending_recheck'],
    default: null
  },
  
  // Auto-reassignment tracking
  isReassigned: {
    type: Boolean,
    default: false
  },
  reassignmentReason: {
    type: String,
    enum: ['user_absent', 'user_overloaded', 'manual_override'],
    default: null
  },
  reassignedAt: {
    type: Date,
    default: null
  },
  reassignmentHistory: [{
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// 🔥 MIDDLEWARE: Auto-update verification status
taskSchema.pre('save', function(next) {
  // Set final verification status based on result
  if (this.verificationResult && !this.finalVerificationStatus) {
    if (this.verificationResult === 'pass') {
      this.finalVerificationStatus = 'approved';
    } else if (this.verificationResult === 'fail') {
      this.finalVerificationStatus = 'rejected';
    } else if (this.verificationResult === 'recheck') {
      this.finalVerificationStatus = 'pending_recheck';
    }
  }
  
  next();
});

// 🔥 INSTANCE METHODS
taskSchema.methods.needsVerification = function() {
  return this.status === 'completed' && 
         (!this.verificationStatus || this.verificationStatus === 'none') &&
         !this.verifierId;
};

taskSchema.methods.isVerificationComplete = function() {
  return this.verificationStatus === 'completed';
};

taskSchema.methods.isVerificationPending = function() {
  return this.verificationStatus === 'pending_verification' && this.verifierId;
};

taskSchema.methods.getVerificationSummary = function() {
  return {
    taskId: this._id,
    title: this.title,
    status: this.status,
    verificationStatus: this.verificationStatus,
    verificationResult: this.verificationResult,
    verificationScore: this.verificationScore,
    finalStatus: this.finalVerificationStatus,
    verifierId: this.verifierId,
    verificationAssignedAt: this.verificationAssignedAt,
    verificationCompletedAt: this.verificationCompletedAt,
    needsVerification: this.needsVerification(),
    isComplete: this.isVerificationComplete(),
    isPending: this.isVerificationPending()
  };
};

// 🔥 STATIC METHODS
taskSchema.statics.getTasksNeedingVerification = function() {
  return this.find({
    status: 'completed',
    $or: [
      { verificationStatus: 'none' },
      { verificationStatus: { $exists: false } },
      { verificationStatus: null }
    ],
    verifierId: { $exists: false }
  });
};

taskSchema.statics.getVerificationStatistics = function(dateFrom, dateTo) {
  const matchFilter = {
    status: 'completed'
  };
  
  if (dateFrom && dateTo) {
    matchFilter.date = { $gte: dateFrom, $lte: dateTo };
  }
  
  return this.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: null,
        totalCompleted: { $sum: 1 },
        needsVerification: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $or: [
                    { $eq: ['$verificationStatus', 'none'] },
                    { $eq: ['$verificationStatus', null] },
                    { $not: { $ifNull: ['$verificationStatus', false] } }
                  ]},
                  { $not: { $ifNull: ['$verifierId', false] } }
                ]
              },
              1,
              0
            ]
          }
        },
        verificationPending: {
          $sum: {
            $cond: [
              { $eq: ['$verificationStatus', 'pending_verification'] },
              1,
              0
            ]
          }
        },
        verificationCompleted: {
          $sum: {
            $cond: [
              { $eq: ['$verificationStatus', 'completed'] },
              1,
              0
            ]
          }
        },
        verificationPassed: {
          $sum: {
            $cond: [
              { $eq: ['$verificationResult', 'pass'] },
              1,
              0
            ]
          }
        },
        verificationFailed: {
          $sum: {
            $cond: [
              { $eq: ['$verificationResult', 'fail'] },
              1,
              0
            ]
          }
        },
        averageScore: { $avg: '$verificationScore' }
      }
    }
  ]);
};

// Enhanced indexes for efficient queries
taskSchema.index({ assignedTo: 1, date: 1, status: 1 });
taskSchema.index({ category: 1, date: 1, status: 1 });
taskSchema.index({ date: 1, priority: 1 });

// 🔥 VERIFICATION INDEXES
taskSchema.index({ verificationStatus: 1, status: 1 });
taskSchema.index({ verifierId: 1, verificationStatus: 1 });
taskSchema.index({ verificationResult: 1, date: 1 });
taskSchema.index({ status: 1, verificationStatus: 1, date: 1 });

// Compound index for verification queries
taskSchema.index({ 
  status: 1, 
  verificationStatus: 1, 
  verifierId: 1,
  date: -1
});

module.exports = mongoose.model('Task', taskSchema);