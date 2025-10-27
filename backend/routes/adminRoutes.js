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
// STAFF MANAGEMENT ROUTES - FIXED VERSION
// ===========================================

// Get All Staff with their profiles (UPDATED)
router.get("/all-staff", adminAuth, async (req, res) => {
  try {
    // Get all users with role 'user'
    const users = await User.find({ role: 'user' }, 'username email createdAt verified').lean();
    
    // Get all profiles and create a map
    const profiles = await UserProfile.find({}).lean();
    const profileMap = new Map();
    profiles.forEach(profile => {
      profileMap.set(profile.userId.toString(), profile);
    });
    
    // Combine user data with profile data
    const staffWithProfiles = users.map(user => {
      const profile = profileMap.get(user._id.toString());
      return {
        _id: user._id, // IMPORTANT: Use userId for operations
        userId: user._id,
        profileId: profile?._id, // Store profile ID separately
        name: profile ? profile.name : user.username,
        email: user.email,
        username: user.username,
        verified: user.verified,
        hasProfile: !!profile,
        createdAt: user.createdAt,
        // Profile data (if exists)
        phone: profile?.phone || 'N/A',
        department: profile?.department || 'Not Set',
        jobTitle: profile?.jobTitle || 'Not Set', 
        shift: profile?.shift || 'Not Set',
        workingHours: profile?.workingHours || { start: '09:00', end: '17:00' },
        skills: profile?.skills || [],
        yearsWorked: profile?.yearsWorked || 0,
        specialTraining: profile?.specialTraining || [],
        shiftFlexibility: profile?.shiftFlexibility || false,
        emergencyContact: profile?.emergencyContact || { name: 'Not Set', relationship: 'Not Set', phone: 'Not Set' },
        notes: profile?.notes || '',
        profileComplete: profile?.profileComplete || false,
        profilePicture: profile?.profilePicture,
        lastUpdated: profile?.lastUpdated || user.updatedAt
      };
    });

    res.status(200).json({
      success: true,
      staff: staffWithProfiles,
      total: staffWithProfiles.length,
      withProfiles: staffWithProfiles.filter(s => s.hasProfile).length,
      withoutProfiles: staffWithProfiles.filter(s => !s.hasProfile).length
    });

  } catch (error) {
    console.error("Get all staff error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch staff data"
    });
  }
});

// Get Single Staff Member with full details (UPDATED)
router.get("/staff/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try to find user by userId first
    const user = await User.findById(id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found"
      });
    }

    const profile = await UserProfile.findOne({ userId: id });

    const staffData = {
      _id: user._id,
      userId: user._id,
      profileId: profile?._id,
      username: user.username,
      email: user.email,
      verified: user.verified,
      hasProfile: !!profile,
      createdAt: user.createdAt,
      
      // Profile data
      name: profile?.name || user.username,
      phone: profile?.phone || 'N/A',
      department: profile?.department || 'Not Set',
      jobTitle: profile?.jobTitle || 'Not Set',
      shift: profile?.shift || 'Not Set',
      workingHours: profile?.workingHours || { start: '09:00', end: '17:00' },
      skills: profile?.skills || [],
      yearsWorked: profile?.yearsWorked || 0,
      specialTraining: profile?.specialTraining || [],
      shiftFlexibility: profile?.shiftFlexibility || false,
      emergencyContact: profile?.emergencyContact,
      notes: profile?.notes || '',
      profileComplete: profile?.profileComplete || false,
      profilePicture: profile?.profilePicture,
      lastUpdated: profile?.lastUpdated
    };

    res.status(200).json({
      success: true,
      staff: staffData
    });

  } catch (error) {
    console.error("Get staff member error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch staff member"
    });
  }
});

// Update Staff Member (UPDATED - Creates profile if doesn't exist)
router.put("/staff/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params; // This is the userId
    const updateData = req.body;

    // Verify user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Prevent updating admin users
    if (user.role === 'admin' || user.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: "Cannot modify admin accounts through this endpoint"
      });
    }

    // Find or create profile
    let profile = await UserProfile.findOne({ userId: id });

    if (profile) {
      // Update existing profile
      Object.assign(profile, {
        name: updateData.name?.trim() || profile.name,
        phone: updateData.phone?.trim() || profile.phone,
        department: updateData.department || profile.department,
        jobTitle: updateData.jobTitle || profile.jobTitle,
        shift: updateData.shift || profile.shift,
        workingHours: updateData.workingHours || profile.workingHours,
        skills: updateData.skills !== undefined ? updateData.skills : profile.skills,
        yearsWorked: updateData.yearsWorked !== undefined ? parseInt(updateData.yearsWorked) : profile.yearsWorked,
        specialTraining: updateData.specialTraining !== undefined ? updateData.specialTraining : profile.specialTraining,
        shiftFlexibility: updateData.shiftFlexibility !== undefined ? updateData.shiftFlexibility : profile.shiftFlexibility,
        emergencyContact: updateData.emergencyContact || profile.emergencyContact,
        notes: updateData.notes !== undefined ? updateData.notes : profile.notes,
        profilePicture: updateData.profilePicture !== undefined ? updateData.profilePicture : profile.profilePicture,
        profileComplete: true,
        lastUpdated: new Date()
      });

      await profile.save();
    } else {
      // Create new profile with defaults
      profile = new UserProfile({
        userId: id,
        name: updateData.name?.trim() || user.username,
        phone: updateData.phone?.trim() || '0000000000',
        department: updateData.department || 'Office Helpers',
        jobTitle: updateData.jobTitle || 'General Helper',
        shift: updateData.shift || 'Morning',
        workingHours: updateData.workingHours || { start: '09:00', end: '17:00' },
        skills: updateData.skills || [],
        yearsWorked: parseInt(updateData.yearsWorked) || 0,
        specialTraining: updateData.specialTraining || [],
        shiftFlexibility: updateData.shiftFlexibility || false,
        emergencyContact: updateData.emergencyContact || {
          name: 'Not Set',
          relationship: 'Not Set',
          phone: '0000000000'
        },
        notes: updateData.notes || '',
        profilePicture: updateData.profilePicture || null,
        profileComplete: true
      });

      await profile.save();
    }

    res.status(200).json({
      success: true,
      message: "Staff information updated successfully",
      staff: {
        userId: user._id,
        profileId: profile._id,
        name: profile.name,
        department: profile.department,
        jobTitle: profile.jobTitle
      }
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
      message: "Failed to update staff information"
    });
  }
});

// Delete Staff Member (UPDATED - Deletes both User and Profile)
router.delete("/staff/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params; // This is the userId

    // Find user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Prevent deleting admin users
    if (user.role === 'admin' || user.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: "Cannot delete admin accounts"
      });
    }

    // Delete profile if exists
    const profile = await UserProfile.findOneAndDelete({ userId: id });

    // Delete user
    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Staff member deleted successfully",
      deletedStaff: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: profile?.name || user.username,
        department: profile?.department || 'Not Set'
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

// Get Staff Statistics (UPDATED)
router.get("/staff-stats", adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalProfiles = await UserProfile.countDocuments();
    
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
    const recentUsers = await User.countDocuments({
      role: 'user',
      createdAt: { $gte: thirtyDaysAgo }
    });

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalProfiles,
        usersWithoutProfiles: totalUsers - totalProfiles,
        recentUsers,
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

// Search Staff (UPDATED)
router.get("/search-staff", adminAuth, async (req, res) => {
  try {
    const { query, department, shift } = req.query;
    
    let profileFilter = {};
    
    if (query) {
      profileFilter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { jobTitle: { $regex: query, $options: 'i' } }
      ];
    }
    
    if (department) {
      profileFilter.department = department;
    }
    
    if (shift) {
      profileFilter.shift = shift;
    }

    const profiles = await UserProfile.find(profileFilter)
      .populate('userId', 'email username')
      .sort({ createdAt: -1 })
      .lean();

    const staffList = profiles.map(profile => ({
      _id: profile.userId._id,
      userId: profile.userId._id,
      profileId: profile._id,
      username: profile.userId.username,
      email: profile.userId.email,
      name: profile.name,
      phone: profile.phone,
      department: profile.department,
      jobTitle: profile.jobTitle,
      shift: profile.shift,
      workingHours: profile.workingHours,
      profileComplete: profile.profileComplete
    }));

    res.status(200).json({
      success: true,
      staff: staffList,
      total: staffList.length
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