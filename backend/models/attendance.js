const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true
  },
  checkIn: {
    time: {
      type: Date,
      required: false // Changed to false since absent/leave won't have check-in
    },
    location: {
      type: String,
      default: 'Office'
    },
    ipAddress: String,
    deviceInfo: String
  },
  checkOut: {
    time: Date,
    location: String,
    ipAddress: String,
    deviceInfo: String
  },
  workingHours: {
    type: Number, // in minutes
    default: 0
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'half-day', 'leave'], // Added 'leave'
    default: 'present'
  },
  notes: {
    type: String,
    maxlength: 500
  },
  // New fields for absent and leave functionality
  absentReason: {
    type: String,
    maxlength: 500
  },
  leaveReason: {
    type: String,
    maxlength: 500
  },
  leaveType: {
    type: String,
    enum: ['sick', 'personal', 'vacation', 'emergency', 'other'],
    required: false
  },
  isApproved: {
    type: Boolean,
    default: null // null = pending, true = approved, false = rejected
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  approvalDate: {
    type: Date,
    required: false
  },
  approvalNotes: {
    type: String,
    maxlength: 500
  },
  isManualEntry: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Create compound index for user and date to prevent duplicate entries
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

// Static method to get today's attendance for a user
attendanceSchema.statics.getTodayAttendance = function(userId) {
  const today = new Date().toISOString().split('T')[0];
  return this.findOne({ userId, date: today });
};

// Method to calculate working hours
attendanceSchema.methods.calculateWorkingHours = function() {
  if (this.checkIn && this.checkIn.time && this.checkOut && this.checkOut.time) {
    const diffInMs = this.checkOut.time - this.checkIn.time;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    this.workingHours = diffInMinutes;
    return diffInMinutes;
  }
  return 0;
};

// Method to determine if late
attendanceSchema.methods.isLate = function() {
  if (!this.checkIn || !this.checkIn.time) return false;
  
  const checkInTime = new Date(this.checkIn.time);
  const hours = checkInTime.getHours();
  const minutes = checkInTime.getMinutes();
  
  // Assuming work starts at 9:00 AM
  const workStartTime = 9 * 60; // 9:00 AM in minutes
  const checkInMinutes = hours * 60 + minutes;
  
  return checkInMinutes > workStartTime;
};

// Method to check if attendance is for absent or leave
attendanceSchema.methods.isAbsentOrLeave = function() {
  return this.status === 'absent' || this.status === 'leave';
};

// Method to get status display text
attendanceSchema.methods.getStatusDisplay = function() {
  switch(this.status) {
    case 'present': return 'Present';
    case 'absent': return 'Absent';
    case 'late': return 'Late';
    case 'half-day': return 'Half Day';
    case 'leave': return 'On Leave';
    default: return 'Unknown';
  }
};

// Pre-save middleware to set status based on conditions
attendanceSchema.pre('save', function(next) {
  // If marked as absent or leave, don't require check-in
  if (this.status === 'absent' || this.status === 'leave') {
    // Clear check-in/check-out data for absent/leave
    this.checkIn = undefined;
    this.checkOut = undefined;
    this.workingHours = 0;
  } else if (this.checkIn && this.checkIn.time && !this.status) {
    // Auto-set status based on check-in time if not already set
    if (this.isLate()) {
      this.status = 'late';
    } else {
      this.status = 'present';
    }
  }
  next();
});

module.exports = mongoose.model('Attendance', attendanceSchema);