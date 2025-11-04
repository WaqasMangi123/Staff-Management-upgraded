const mongoose = require("mongoose");

// Secret Team Schema
const secretTeamSchema = new mongoose.Schema({
  teamName: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 50
  },
  teamCode: { 
    type: String, 
    required: true, 
    unique: true,
    uppercase: true,
    match: /^ST\d{3}$/  // Format: ST123
  },
  members: [{
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    assignedAt: { 
      type: Date, 
      default: Date.now 
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  isActive: { 
    type: Boolean, 
    default: true 
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  lastRotation: {
    type: Date,
    default: Date.now
  }
});

// Validation: Must have exactly 3 members
secretTeamSchema.pre('save', function(next) {
  if (this.members.length !== 3) {
    next(new Error('Secret team must have exactly 3 members'));
  }
  next();
});

// Verification Task Schema
const verificationTaskSchema = new mongoose.Schema({
  taskId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Task', 
    required: true,
    unique: true  // Prevent duplicate verifications
  },
  originalStaffId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  assignedVerifier: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  assignedTeam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SecretTeam',
    required: true
  },
  verificationStatus: { 
    type: String, 
    enum: ['pending', 'in-progress', 'completed', 'overdue'], 
    default: 'pending' 
  },
  verificationResult: { 
    type: String, 
    enum: ['pass', 'fail', 'recheck'], 
    default: null 
  },
  cleanliness: { 
    type: Number, 
    min: [1, 'Cleanliness rating must be at least 1'], 
    max: [5, 'Cleanliness rating cannot exceed 5'],
    validate: {
      validator: Number.isInteger,
      message: 'Cleanliness rating must be a whole number'
    }
  },
  completeness: { 
    type: Number, 
    min: [1, 'Completeness rating must be at least 1'], 
    max: [5, 'Completeness rating cannot exceed 5'],
    validate: {
      validator: Number.isInteger,
      message: 'Completeness rating must be a whole number'
    }
  },
  quality: { 
    type: Number, 
    min: [1, 'Quality rating must be at least 1'], 
    max: [5, 'Quality rating cannot exceed 5'],
    validate: {
      validator: Number.isInteger,
      message: 'Quality rating must be a whole number'
    }
  },
  overallScore: { 
    type: Number, 
    min: 1, 
    max: 5 
  },
  comments: { 
    type: String, 
    default: '',
    maxlength: 500
  },
  issues: [{
    category: {
      type: String,
      enum: ['cleanliness', 'incomplete', 'damage', 'safety', 'other'],
      required: true
    },
    description: {
      type: String,
      required: true,
      maxlength: 200
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    }
  }],
  location: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  assignedAt: { 
    type: Date, 
    default: Date.now 
  },
  verifiedAt: { 
    type: Date 
  },
  deadline: { 
    type: Date, 
    required: true,
    validate: {
      validator: function(deadline) {
        return deadline > this.assignedAt;
      },
      message: 'Deadline must be after assignment date'
    }
  },
  isAnonymous: {
    type: Boolean,
    default: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  }
});

// Auto calculate overall score and determine result
verificationTaskSchema.pre('save', function(next) {
  if (this.cleanliness && this.completeness && this.quality) {
    // Calculate average score (rounded to 1 decimal)
    this.overallScore = Math.round(((this.cleanliness + this.completeness + this.quality) / 3) * 10) / 10;
    
    // Determine result based on score
    if (this.overallScore >= 4) {
      this.verificationResult = 'pass';
    } else if (this.overallScore >= 2.5) {
      this.verificationResult = 'recheck';
    } else {
      this.verificationResult = 'fail';
    }
    
    // Mark as completed if all ratings provided
    if (this.verificationStatus === 'pending') {
      this.verificationStatus = 'completed';
      this.verifiedAt = new Date();
    }
  }
  
  // Check if overdue
  if (this.verificationStatus === 'pending' && new Date() > this.deadline) {
    this.verificationStatus = 'overdue';
  }
  
  next();
});

// Instance method to check if verification is overdue
verificationTaskSchema.methods.isOverdue = function() {
  return this.verificationStatus === 'pending' && new Date() > this.deadline;
};

// Static method to find overdue verifications
verificationTaskSchema.statics.findOverdue = function() {
  return this.find({
    verificationStatus: 'pending',
    deadline: { $lt: new Date() }
  });
};

// Static method to get team workload
secretTeamSchema.statics.getTeamWorkload = async function(teamId) {
  const VerificationTask = mongoose.model('VerificationTask');
  return await VerificationTask.countDocuments({
    assignedTeam: teamId,
    verificationStatus: { $in: ['pending', 'in-progress'] }
  });
};

// Indexes for better performance
secretTeamSchema.index({ teamCode: 1 });
secretTeamSchema.index({ isActive: 1 });
secretTeamSchema.index({ 'members.userId': 1 });

verificationTaskSchema.index({ taskId: 1 });
verificationTaskSchema.index({ assignedVerifier: 1 });
verificationTaskSchema.index({ verificationStatus: 1 });
verificationTaskSchema.index({ assignedAt: -1 });
verificationTaskSchema.index({ deadline: 1 });
verificationTaskSchema.index({ assignedTeam: 1 });

// Compound indexes
verificationTaskSchema.index({ assignedVerifier: 1, verificationStatus: 1 });
verificationTaskSchema.index({ verificationStatus: 1, deadline: 1 });

const SecretTeam = mongoose.model("SecretTeam", secretTeamSchema);
const VerificationTask = mongoose.model("VerificationTask", verificationTaskSchema);

module.exports = { SecretTeam, VerificationTask };