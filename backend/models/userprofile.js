const mongoose = require("mongoose");

const userProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
    maxlength: [50, "Name cannot exceed 50 characters"]
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
    type: String,
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
  notes: {
    type: String,
    maxlength: [500, "Notes cannot exceed 500 characters"]
  },
  profileComplete: {
    type: Boolean,
    default: false
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const UserProfile = mongoose.model("UserProfile", userProfileSchema);

module.exports = UserProfile;