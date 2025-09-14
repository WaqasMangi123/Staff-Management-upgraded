const mongoose = require("mongoose");

const scheduleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true
  },
  shift: {
    type: String,
    enum: ['Morning', 'Evening', 'Night', 'Flexible'],
    required: true
  },
  startTime: {
    type: String, // HH:MM format
    required: true
  },
  endTime: {
    type: String, // HH:MM format
    required: true
  },
  department: {
    type: String,
    required: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'missed', 'swapped'],
    default: 'scheduled'
  },
  swapRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShiftSwap',
    default: null
  }
}, {
  timestamps: true
});

scheduleSchema.index({ userId: 1, date: 1 }, { unique: true });
module.exports = mongoose.model('Schedule', scheduleSchema);