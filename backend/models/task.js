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

// Index for efficient queries
taskSchema.index({ assignedTo: 1, date: 1, status: 1 });
taskSchema.index({ category: 1, date: 1, status: 1 });
taskSchema.index({ date: 1, priority: 1 });

module.exports = mongoose.model('Task', taskSchema);