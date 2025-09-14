const express = require("express");
const router = express.Router();
const Admin = require("../models/admin");
const UserProfile = require("../models/userprofile");
const User = require("../models/user");
const jwt = require("jsonwebtoken");
const adminAuth = require("../middleware/adminAuth");

// Admin Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // Find admin and include password field
    const admin = await Admin.findOne({ email: email.toLowerCase().trim() })
      .select('+password');

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Check if admin is active
    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated. Contact system administrator."
      });
    }

    // Verify password
    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Generate JWT token
    const token = jwt.sign(
      {
        id: admin._id,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" } // Longer session for admin
    );

    // Prepare response data
    const adminData = {
      id: admin._id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions,
      lastLogin: admin.lastLogin,
      createdAt: admin.createdAt
    };

    res.status(200).json({
      success: true,
      message: "Admin login successful",
      token,
      admin: adminData
    });

  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed. Please try again later."
    });
  }
});

// Create Admin (Protected route - only super_admin can create new admins)
router.post("/create", adminAuth, async (req, res) => {
  try {
    // Check if current admin has permission
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: "Only super administrators can create new admin accounts"
      });
    }

    const { username, email, password, role, permissions } = req.body;

    // Input validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, email, and password are required"
      });
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: "An admin with this email already exists"
      });
    }

    // Create new admin
    const newAdmin = new Admin({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: password.trim(),
      role: role || 'admin',
      permissions: permissions || ['staff_management', 'duty_scheduling'],
      createdBy: req.user.id
    });

    await newAdmin.save();

    res.status(201).json({
      success: true,
      message: "Admin account created successfully",
      admin: {
        id: newAdmin._id,
        username: newAdmin.username,
        email: newAdmin.email,
        role: newAdmin.role,
        permissions: newAdmin.permissions
      }
    });

  } catch (error) {
    console.error("Create admin error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create admin account"
    });
  }
});

// Get Admin Profile
router.get("/profile", adminAuth, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found"
      });
    }

    res.status(200).json({
      success: true,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        lastLogin: admin.lastLogin,
        createdAt: admin.createdAt
      }
    });

  } catch (error) {
    console.error("Get admin profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch admin profile"
    });
  }
});

// Admin Logout
router.post("/logout", adminAuth, async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (error) {
    console.error("Admin logout error:", error);
    res.status(500).json({
      success: false,
      message: "Logout failed"
    });
  }
});

// Get All Admins (Super admin only)
router.get("/list", adminAuth, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const admins = await Admin.find({})
      .select('-password')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      admins
    });

  } catch (error) {
    console.error("Get admins error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch admins"
    });
  }
});

// Update Admin Status
router.patch("/status/:id", adminAuth, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const { id } = req.params;
    const { isActive } = req.body;

    const admin = await Admin.findByIdAndUpdate(
      id,
      { isActive },
      { new: true }
    ).select('-password');

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found"
      });
    }

    res.status(200).json({
      success: true,
      message: `Admin ${isActive ? 'activated' : 'deactivated'} successfully`,
      admin
    });

  } catch (error) {
    console.error("Update admin status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update admin status"
    });
  }
});

// ===========================================
// STAFF MANAGEMENT ROUTES
// ===========================================

// Get All Staff with their profiles
router.get("/all-staff", adminAuth, async (req, res) => {
  try {
    // Get all users with their profiles
    const users = await User.find({ role: 'user' }, 'username email createdAt').lean();
    
    // Get all profiles and match with users
    const profiles = await UserProfile.find({}).lean();
    
    // Combine user data with profile data
    const staffWithProfiles = users.map(user => {
      const profile = profiles.find(p => p.userId.toString() === user._id.toString());
      return {
        _id: profile ? profile._id : user._id,
        userId: user._id,
        name: profile ? profile.name : user.username,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
        // Profile data (if exists)
        phone: profile?.phone || 'N/A',
        department: profile?.department || 'Not Set',
        jobTitle: profile?.jobTitle || 'Not Set', 
        shift: profile?.shift || 'Not Set',
        workingHours: profile?.workingHours || { start: 'N/A', end: 'N/A' },
        skills: profile?.skills || [],
        yearsWorked: profile?.yearsWorked || 0,
        specialTraining: profile?.specialTraining || [],
        shiftFlexibility: profile?.shiftFlexibility || false,
        emergencyContact: profile?.emergencyContact || { name: 'N/A', relationship: 'N/A', phone: 'N/A' },
        notes: profile?.notes || '',
        profileComplete: profile?.profileComplete || false,
        profilePicture: profile?.profilePicture,
        lastUpdated: profile?.lastUpdated
      };
    });

    res.status(200).json({
      success: true,
      staff: staffWithProfiles,
      total: staffWithProfiles.length
    });

  } catch (error) {
    console.error("Get all staff error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch staff data"
    });
  }
});

// Get Single Staff Member with full details
router.get("/staff/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find profile by ID
    const profile = await UserProfile.findById(id).populate('userId', 'username email createdAt');
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found"
      });
    }

    res.status(200).json({
      success: true,
      staff: profile
    });

  } catch (error) {
    console.error("Get staff member error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch staff member"
    });
  }
});

// Update Staff Member
router.put("/staff/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.userId;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    // Update the profile
    const updatedProfile = await UserProfile.findByIdAndUpdate(
      id,
      {
        ...updateData,
        lastUpdated: new Date()
      },
      { 
        new: true,
        runValidators: true
      }
    );

    if (!updatedProfile) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Staff member updated successfully",
      staff: updatedProfile
    });

  } catch (error) {
    console.error("Update staff error:", error);
    
    if (error.name === 'ValidationError') {
      const errorMessages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: errorMessages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to update staff member"
    });
  }
});

// Delete Staff Member
router.delete("/staff/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the profile first to get user details
    const profile = await UserProfile.findById(id);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found"
      });
    }

    // Delete the profile
    await UserProfile.findByIdAndDelete(id);
    
    // Optionally, also delete the user account
    // Uncomment the next line if you want to delete the user account as well
    // await User.findByIdAndDelete(profile.userId);
    
    res.status(200).json({
      success: true,
      message: "Staff member deleted successfully",
      deletedStaff: {
        id: profile._id,
        name: profile.name,
        department: profile.department
      }
    });

  } catch (error) {
    console.error("Delete staff error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete staff member"
    });
  }
});

// Get Staff Statistics
router.get("/staff-stats", adminAuth, async (req, res) => {
  try {
    const totalStaff = await UserProfile.countDocuments();
    
    // Get staff by department
    const departmentStats = await UserProfile.aggregate([
      {
        $group: {
          _id: "$department",
          count: { $sum: 1 }
        }
      }
    ]);

    // Get staff by shift
    const shiftStats = await UserProfile.aggregate([
      {
        $group: {
          _id: "$shift", 
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent staff additions (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentStaff = await UserProfile.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    res.status(200).json({
      success: true,
      stats: {
        totalStaff,
        recentStaff,
        departmentStats,
        shiftStats
      }
    });

  } catch (error) {
    console.error("Get staff stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch staff statistics"
    });
  }
});

// Search Staff
router.get("/search-staff", adminAuth, async (req, res) => {
  try {
    const { query, department, shift } = req.query;
    
    let searchFilter = {};
    
    if (query) {
      searchFilter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { jobTitle: { $regex: query, $options: 'i' } }
      ];
    }
    
    if (department) {
      searchFilter.department = department;
    }
    
    if (shift) {
      searchFilter.shift = shift;
    }

    const staff = await UserProfile.find(searchFilter)
      .populate('userId', 'email username')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      staff,
      total: staff.length
    });

  } catch (error) {
    console.error("Search staff error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search staff"
    });
  }
});

module.exports = router;