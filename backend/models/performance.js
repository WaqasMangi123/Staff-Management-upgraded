const mongoose = require("mongoose");

const performanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  month: {
    type: String, // Format: YYYY-MM
    required: true
  },
  attendanceScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  taskCompletionRate: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  averageTaskRating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  punctualityScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  totalWorkingHours: {
    type: Number,
    default: 0
  },
  totalTasks: {
    type: Number,
    default: 0
  },
  completedTasks: {
    type: Number,
    default: 0
  },
  lateArrivals: {
    type: Number,
    default: 0
  },
  absences: {
    type: Number,
    default: 0
  },
  supervisorRating: {
    type: Number,
    min: 1,
    max: 5
  },
  supervisorComments: {
    type: String,
    maxlength: 1000
  },
  achievements: [{
    title: String,
    description: String,
    date: Date
  }],
  areas_for_improvement: [{
    area: String,
    description: String,
    date: Date
  }]
}, {
  timestamps: true
});

performanceSchema.index({ userId: 1, month: 1 }, { unique: true });
module.exports = mongoose.model('Performance', performanceSchema);