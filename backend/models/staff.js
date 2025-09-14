const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema({
  // Basic Information
  employeeId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
    maxlength: [50, "Name cannot exceed 50 characters"]
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: props => `${props.value} is not a valid email address!`
    }
  },
  phone: {
    type: String,
    required: [true, "Phone number is required"],
    trim: true,
    validate: {
      validator: function(v) {
        return /^\+?[\d\s\-()]{10,15}$/.test(v);
      },
      message: "Please enter a valid phone number"
    }
  },
  profilePicture: {
    type: String, // URL to image
    default: null
  },

  // Job Details
  department: {
    type: String,
    required: true,
    enum: [
      'Cleaning Staff',
      'Event Helpers', 
      'Tea and Snack Staff',
      'Maintenance Staff',
      'Outdoor Cleaners',
      'Office Helpers'
    ]
  },
  jobTitle: {
    type: String,
    required: true,
    enum: [
      'Classroom Cleaner',
      'Restroom Cleaner', 
      'Floor Care Team',
      'Meeting Attendant',
      'Event Setup Helper',
      'Document Runner',
      'Tea Server',
      'Refreshment Helper',
      'Key Handler',
      'Repair Technician',
      'Waste Collector',
      'Gardener',
      'Outdoor Cleaner',
      'Supply Assistant',
      'General Helper'
    ]
  },
  shift: {
    type: String,
    required: true,
    enum: ['Morning', 'Evening', 'Night', 'Flexible']
  },
  workingHours: {
    start: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: "Please enter time in HH:MM format"
      }
    },
    end: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: "Please enter time in HH:MM format"
      }
    }
  },

  // Skills and Experience
  skills: [{
    type: String,
    enum: [
      'Cleaning Areas',
      'Using Tools', 
      'Waste Management',
      'Language Skills',
      'Lab Cleaning',
      'Event Setup',
      'Tea Service',
      'Basic Maintenance'
    ]
  }],
  yearsWorked: {
    type: Number,
    required: true,
    min: 0,
    max: 50
  },
  specialTraining: [{
    type: String
  }],
  shiftFlexibility: {
    type: Boolean,
    default: false
  },

  // Status and Availability
  status: {
    type: String,
    enum: ['Active', 'On Leave', 'Inactive'],
    default: 'Active'
  },
  availability: {
    type: String,
    enum: ['Available', 'Busy', 'On Leave', 'Sick'],
    default: 'Available'
  },

  // Performance Tracking
  performanceMetrics: {
    taskCompletionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    attendanceRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    lastReviewDate: {
      type: Date
    }
  },

  // Leave Management
  leaveBalance: {
    casual: {
      type: Number,
      default: 12
    },
    sick: {
      type: Number,
      default: 10
    },
    annual: {
      type: Number,
      default: 15
    }
  },

  // Emergency Contact
  emergencyContact: {
    name: {
      type: String,
      required: true
    },
    relationship: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    }
  },

  // System Fields
  hireDate: {
    type: Date,
    required: true
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    maxlength: [500, "Notes cannot exceed 500 characters"]
  },
  recognitions: [{
    title: String,
    date: Date,
    description: String
  }]
}, {
  timestamps: true
});

// Generate employee ID automatically
staffSchema.pre('save', async function(next) {
  if (!this.employeeId) {
    const count = await this.constructor.countDocuments();
    this.employeeId = `EMP${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Calculate performance score
staffSchema.methods.calculatePerformanceScore = function() {
  const { taskCompletionRate, attendanceRate, rating } = this.performanceMetrics;
  return ((taskCompletionRate * 0.4) + (attendanceRate * 0.4) + (rating * 20 * 0.2));
};

// Check if staff can take leave
staffSchema.methods.canTakeLeave = function(leaveType, days) {
  return this.leaveBalance[leaveType] >= days;
};

// Deduct leave days
staffSchema.methods.deductLeave = function(leaveType, days) {
  if (this.canTakeLeave(leaveType, days)) {
    this.leaveBalance[leaveType] -= days;
    return true;
  }
  return false;
};

const Staff = mongoose.model("Staff", staffSchema);

module.exports = Staff;