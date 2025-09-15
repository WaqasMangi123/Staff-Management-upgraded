const express = require("express");
const router = express.Router();
const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const UserProfile = require("../models/userprofile");
const Attendance = require("../models/attendance");
const mongoose = require('mongoose');
console.log("UserProfile model loaded:", UserProfile.modelName); // Add this debug line
require("dotenv").config();

// Environment Variable
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Nodemailer Setup
const transporter = nodemailer.createTransporter({
  service: "gmail",
  auth: { 
    user: EMAIL_USER, 
    pass: EMAIL_PASS 
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Helper Functions
const generateVerificationCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendVerificationEmail = async (email, verificationCode) => {
  try {
    await transporter.sendMail({
      from: `"Parksy Portal" <${EMAIL_USER}>`,
      to: email,
      subject: "Verify Your Email Address",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Email Verification</h2>
          <p>Your verification code is: <strong>${verificationCode}</strong></p>
          <p>This code will expire in 10 minutes.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Email sending error:", err);
    throw new Error("Failed to send verification email");
  }
};

// Middleware to extract user from JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required"
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error("Token verification error:", err);
      return res.status(403).json({
        success: false,
        message: "Invalid or expired token"
      });
    }
    req.user = user;
    next();
  });
};

// Middleware to update lastActive timestamp
router.use(async (req, res, next) => {
  if (req.user) {
    try {
      await User.findByIdAndUpdate(req.user.id, { lastActive: new Date() });
    } catch (err) {
      console.error("Error updating lastActive:", err);
    }
  }
  next();
});

// Input Validation Middleware
const validateRegisterInput = (req, res, next) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ 
      success: false,
      message: "Username, email and password are required" 
    });
  }
  
  if (username.trim().length < 3) {
    return res.status(400).json({ 
      success: false,
      message: "Username must be at least 3 characters" 
    });
  }
  
  if (password.length < 8) {
    return res.status(400).json({ 
      success: false,
      message: "Password must be at least 8 characters" 
    });
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      success: false,
      message: "Please enter a valid email address" 
    });
  }
  
  next();
};

const validateLoginInput = (req, res, next) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ 
      success: false,
      message: "Email and password are required" 
    });
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      success: false,
      message: "Please enter a valid email address" 
    });
  }
  
  next();
};

// 🔹 User Registration - Let schema handle password hashing
router.post("/register", validateRegisterInput, async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    // Check if user exists
    const existingUser = await User.findOne({ email: trimmedEmail });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: "An account with this email already exists" 
      });
    }

    const verificationCode = generateVerificationCode();

    const newUser = new User({
      username: username.trim(),
      email: trimmedEmail,
      password: trimmedPassword, // Schema will hash it
      verified: false,
      verificationCode,
      verificationCodeExpires: Date.now() + 10 * 60 * 1000, // 10 minutes
      role: 'user'
    });

    await newUser.save();
    await sendVerificationEmail(newUser.email, verificationCode);

    res.status(201).json({ 
      success: true,
      message: "Account created successfully! Please check your email for verification code.",
      userId: newUser._id 
    });

  } catch (err) {
    console.error("Registration Error:", err);
    res.status(500).json({ 
      success: false,
      message: "Server error during registration. Please try again.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// 🔹 Email Verification
router.post("/verify", async (req, res) => {
  try {
    const { email, verificationCode } = req.body;
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !verificationCode) {
      return res.status(400).json({ 
        success: false,
        message: "Email and verification code are required" 
      });
    }

    if (!/^\d{6}$/.test(verificationCode)) {
      return res.status(400).json({ 
        success: false,
        message: "Verification code must be 6 digits" 
      });
    }

    const user = await User.findOne({
      email: trimmedEmail,
      verificationCode,
      verificationCodeExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid or expired verification code" 
      });
    }

    // Mark as verified
    user.verified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id,
        email: user.email,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(200).json({ 
      success: true,
      message: "Email verified successfully! You are now logged in.",
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role
      }
    });

  } catch (err) {
    console.error("Verification Error:", err);
    res.status(500).json({ 
      success: false,
      message: "Server error during verification. Please try again."
    });
  }
});

// 🔹 User Login with detailed error messages
router.post("/login", validateLoginInput, async (req, res) => {
  try {
    const { email, password } = req.body;
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    // Find user and include password field
    const user = await User.findOne({ email: trimmedEmail }).select('+password +verificationCode +verificationCodeExpires');
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: "No account found with this email address"
      });
    }

    if (!user.verified) {
      return res.status(403).json({ 
        success: false,
        isVerified: false,
        message: "Please verify your email before logging in. Check your inbox for the verification code."
      });
    }

    if (!user.password) {
      return res.status(500).json({ 
        success: false,
        message: "Account error. Please contact support."
      });
    }

    // Use the User model's comparePassword method
    const isPasswordValid = await user.comparePassword(trimmedPassword);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false,
        message: "Incorrect password. Please try again."
      });
    }

    // Update last login time
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id,
        email: user.email,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Return user data without password
    const userResponse = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    res.status(200).json({
      success: true,
      message: "Welcome back! Login successful.",
      token,
      user: userResponse
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ 
      success: false,
      message: "Server error during login. Please try again."
    });
  }
});

// 🔹 Resend Verification Email
router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      return res.status(400).json({ 
        success: false,
        message: "Email is required" 
      });
    }

    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "No account found with this email address" 
      });
    }

    if (user.verified) {
      return res.status(400).json({ 
        success: false,
        message: "This account is already verified" 
      });
    }

    // Generate new verification code
    const verificationCode = generateVerificationCode();
    user.verificationCode = verificationCode;
    user.verificationCodeExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    await sendVerificationEmail(user.email, verificationCode);

    res.status(200).json({ 
      success: true,
      message: "Verification email sent! Please check your inbox." 
    });

  } catch (err) {
    console.error("Resend Verification Error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to send verification email. Please try again."
    });
  }
});

// 🔹 Forgot Password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      return res.status(400).json({ 
        success: false,
        message: "Email is required" 
      });
    }

    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
      return res.status(200).json({ 
        success: true,
        message: "If an account exists with this email, a reset link has been sent" 
      });
    }

    // Generate reset token
    const resetToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1h" });
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send email with reset link
    const resetUrl = `https://parksy.uk/#/reset-password/${resetToken}`;
    await transporter.sendMail({
      from: `"Parksy Portal" <${EMAIL_USER}>`,
      to: user.email,
      subject: "Password Reset Request",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Password Reset</h2>
          <p>Click below to reset your password:</p>
          <a href="${resetUrl}" 
             style="display: inline-block; padding: 10px 20px; 
                    background-color: #2563eb; color: white; 
                    text-decoration: none; border-radius: 5px; 
                    margin: 20px 0;">
            Reset Password
          </a>
          <p>This link expires in 1 hour.</p>
        </div>
      `,
    });

    res.status(200).json({ 
      success: true,
      message: "Password reset link sent to your email" 
    });

  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ 
      success: false,
      message: "Server error processing your request"
    });
  }
});

// 🔹 Validate Reset Token
router.post("/validate-reset-token", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ 
        valid: false,
        message: "Token is required" 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await User.findOne({
      _id: decoded.id,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(200).json({ 
        valid: false,
        message: "Invalid or expired token" 
      });
    }

    res.status(200).json({ 
      valid: true,
      message: "Token is valid",
      email: user.email
    });

  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(200).json({ 
        valid: false,
        message: "Token has expired" 
      });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(200).json({ 
        valid: false,
        message: "Invalid token" 
      });
    }
    console.error("Token validation error:", err);
    res.status(500).json({ 
      valid: false,
      message: "Server error during token validation" 
    });
  }
});

// 🔹 Reset Password
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ 
        success: false,
        message: "Token and new password are required" 
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ 
        success: false,
        message: "Password must be at least 8 characters" 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await User.findOne({
      _id: decoded.id,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    }).select('+password');

    if (!user) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid or expired reset token" 
      });
    }

    // Check if new password is same as old
    const isSamePassword = await user.comparePassword(newPassword.trim());
    if (isSamePassword) {
      return res.status(400).json({ 
        success: false,
        message: "New password must be different from your current password" 
      });
    }

    // Let schema handle password hashing
    user.password = newPassword.trim();
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Send confirmation email
    await transporter.sendMail({
      from: `"Parksy Portal" <${EMAIL_USER}>`,
      to: user.email,
      subject: "Password Changed Successfully",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Password Updated</h2>
          <p>Your password was successfully changed.</p>
          <p>If you didn't make this change, please contact support immediately.</p>
        </div>
      `,
    });

    res.status(200).json({ 
      success: true,
      message: "Password updated successfully! You can now login with your new password." 
    });

  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ 
      success: false,
      message: "Server error processing your request"
    });
  }
});

// 🔹 Get All Users
router.get("/users", async (req, res) => {
  try {
    const users = await User.find({}, 'username email role createdAt lastActive verified')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      users: users.map(user => ({
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        lastActive: user.lastActive,
        verified: user.verified
      }))
    });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({
      success: false,
      message: "Server error fetching users",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// 🔹 Get Active Users
router.get("/active-users", async (req, res) => {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    
    const activeUsers = await User.find(
      { lastActive: { $gte: fifteenMinutesAgo } },
      'username email role lastActive'
    ).sort({ lastActive: -1 });

    res.status(200).json({
      success: true,
      activeUsers,
      count: activeUsers.length,
      lastUpdated: new Date()
    });
  } catch (err) {
    console.error("Error fetching active users:", err);
    res.status(500).json({
      success: false,
      message: "Server error fetching active users"
    });
  }
});

// 🔹 Delete User
router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
      deletedUser: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });

  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({
      success: false,
      message: "Server error while deleting user",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// 🔹 Get User Profile (Updated with authentication and validation)
router.get("/profile/:userId", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log("=== Get Profile Request ===");
    console.log("Requested userId:", userId);
    console.log("Request user from token:", req.user);
    
    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log("Invalid userId format");
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }
    
    // Check authorization - user can only view their own profile unless admin
    if (req.user.id !== userId && req.user.role !== 'admin') {
      console.log("Authorization failed: User trying to access different profile");
      return res.status(403).json({
        success: false,
        message: "You can only access your own profile"
      });
    }
    
    const profile = await UserProfile.findOne({ userId });
    console.log("Profile found:", !!profile);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found"
      });
    }

    console.log("Sending profile data");
    res.status(200).json({
      success: true,
      profile
    });

  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 🔹 Update/Create User Profile (Fixed with authentication and better validation)
router.post("/update-profile", authenticateToken, async (req, res) => {
  try {
    console.log("=== Profile Update Request ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    console.log("User from token:", req.user);

    const {
      userId,
      name,
      phone,
      profilePicture,
      department,
      jobTitle,
      shift,
      workingHours,
      skills,
      yearsWorked,
      specialTraining,
      shiftFlexibility,
      emergencyContact,
      notes
    } = req.body;

    // Input validation
    if (!userId || !name || !phone || !department || !jobTitle || !shift) {
      console.log("Validation failed: Missing required fields");
      return res.status(400).json({
        success: false,
        message: "Required fields: userId, name, phone, department, jobTitle, shift"
      });
    }

    // Validate userId format (MongoDB ObjectId)
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log("Validation failed: Invalid userId format");
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    // Validate working hours
    if (!workingHours || !workingHours.start || !workingHours.end) {
      console.log("Validation failed: Missing working hours");
      return res.status(400).json({
        success: false,
        message: "Working hours start and end times are required"
      });
    }

    // Validate emergency contact
    if (!emergencyContact || !emergencyContact.name || !emergencyContact.relationship || !emergencyContact.phone) {
      console.log("Validation failed: Missing emergency contact");
      return res.status(400).json({
        success: false,
        message: "Emergency contact information is required"
      });
    }

    // Verify user exists
    const userExists = await User.findById(userId);
    if (!userExists) {
      console.log("User not found:", userId);
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check authorization - user can only update their own profile unless admin
    if (req.user.id !== userId && req.user.role !== 'admin') {
      console.log("Authorization failed: User trying to update different profile");
      return res.status(403).json({
        success: false,
        message: "You can only update your own profile"
      });
    }

    console.log("All validations passed, proceeding with profile update/create");

    // Check if profile exists
    let profile = await UserProfile.findOne({ userId });
    console.log("Existing profile found:", !!profile);

    // Prepare clean data
    const profileData = {
      userId,
      name: name.trim(),
      phone: phone.trim(),
      profilePicture: profilePicture || null,
      department,
      jobTitle,
      shift,
      workingHours: {
        start: workingHours.start,
        end: workingHours.end
      },
      skills: Array.isArray(skills) ? skills : [],
      yearsWorked: parseInt(yearsWorked) || 0,
      specialTraining: Array.isArray(specialTraining) ? 
        specialTraining.filter(training => training && training.trim() !== '') : [],
      shiftFlexibility: Boolean(shiftFlexibility),
      emergencyContact: {
        name: emergencyContact.name.trim(),
        relationship: emergencyContact.relationship.trim(),
        phone: emergencyContact.phone.trim()
      },
      notes: notes ? notes.trim() : '',
      profileComplete: true,
      lastUpdated: new Date()
    };

    console.log("Prepared profile data:", JSON.stringify(profileData, null, 2));

    if (profile) {
      console.log("Updating existing profile");
      // Update existing profile
      Object.assign(profile, profileData);
      await profile.save();
      console.log("Profile updated successfully");
    } else {
      console.log("Creating new profile");
      // Create new profile
      profile = new UserProfile(profileData);
      await profile.save();
      console.log("New profile created successfully");
    }

    const responseData = {
      success: true,
      message: profile.isNew === false ? "Profile updated successfully" : "Profile created successfully",
      profile: {
        id: profile._id,
        userId: profile.userId,
        name: profile.name,
        department: profile.department,
        jobTitle: profile.jobTitle,
        profileComplete: profile.profileComplete,
        lastUpdated: profile.lastUpdated
      }
    };

    console.log("Sending success response:", responseData);
    res.status(200).json(responseData);

  } catch (error) {
    console.error("=== Profile Update Error ===");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    
    if (error.name === 'ValidationError') {
      console.error("Mongoose validation errors:", error.errors);
      const errorMessages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: `Validation error: ${errorMessages.join(', ')}`,
        validationErrors: error.errors
      });
    }
    
    if (error.name === 'CastError') {
      console.error("MongoDB cast error:", error);
      return res.status(400).json({
        success: false,
        message: "Invalid data format provided"
      });
    }

    if (error.code === 11000) {
      console.error("MongoDB duplicate key error:", error.keyPattern);
      return res.status(400).json({
        success: false,
        message: "Profile already exists for this user"
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// 🔹 Test Database Connection Route (Add this for debugging)
router.get("/test-db", async (req, res) => {
  try {
    console.log("=== Database Test ===");
    
    // Test User model
    const userCount = await User.countDocuments();
    console.log("User count:", userCount);
    
    // Test UserProfile model
    const profileCount = await UserProfile.countDocuments();
    console.log("Profile count:", profileCount);
    
    // Test sample user lookup
    const sampleUser = await User.findOne().limit(1);
    console.log("Sample user found:", !!sampleUser);
    
    // Test model loading
    console.log("User model name:", User.modelName);
    console.log("UserProfile model name:", UserProfile.modelName);
    
    res.json({
      success: true,
      database: "connected",
      collections: {
        users: userCount,
        profiles: profileCount
      },
      models: {
        User: User.modelName,
        UserProfile: UserProfile.modelName
      },
      sampleUser: sampleUser ? {
        id: sampleUser._id,
        username: sampleUser.username,
        email: sampleUser.email,
        role: sampleUser.role
      } : null,
      environment: process.env.NODE_ENV || 'development'
    });
    
  } catch (error) {
    console.error("Database test error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      database: "error",
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// 🔹 ATTENDANCE ROUTES

// Mark Check-in
router.post("/attendance/check-in", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    
    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if already checked in today or marked absent/leave
    const existingAttendance = await Attendance.findOne({ userId, date: today });
    if (existingAttendance) {
      if (existingAttendance.status === 'absent' || existingAttendance.status === 'leave') {
        return res.status(400).json({
          success: false,
          message: `Cannot check in - already marked as ${existingAttendance.status} for today`
        });
      }
      if (existingAttendance.checkIn && existingAttendance.checkIn.time) {
        return res.status(400).json({
          success: false,
          message: "Already checked in today",
          checkInTime: existingAttendance.checkIn.time
        });
      }
    }

    const checkInTime = new Date();
    const { location, notes } = req.body;

    // Create or update attendance record
    let attendance;
    if (existingAttendance) {
      attendance = existingAttendance;
      attendance.checkIn = {
        time: checkInTime,
        location: location || 'Office',
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent']
      };
    } else {
      attendance = new Attendance({
        userId,
        username: user.username,
        email: user.email,
        date: today,
        checkIn: {
          time: checkInTime,
          location: location || 'Office',
          ipAddress: req.ip,
          deviceInfo: req.headers['user-agent']
        },
        notes: notes || ''
      });
    }

    // Check if late (assuming work starts at 9:00 AM)
    const checkInHour = checkInTime.getHours();
    const checkInMinutes = checkInTime.getMinutes();
    const workStartMinutes = 9 * 60; // 9:00 AM
    const checkInTotalMinutes = checkInHour * 60 + checkInMinutes;
    
    if (checkInTotalMinutes > workStartMinutes) {
      attendance.status = 'late';
    } else {
      attendance.status = 'present';
    }

    await attendance.save();

    res.status(200).json({
      success: true,
      message: `Checked in successfully at ${checkInTime.toLocaleTimeString()}`,
      attendance: {
        id: attendance._id,
        checkInTime: attendance.checkIn.time,
        status: attendance.status,
        isLate: attendance.status === 'late'
      }
    });

  } catch (error) {
    console.error("Check-in error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check in"
    });
  }
});

// Mark Check-out
router.post("/attendance/check-out", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    
    // Find today's attendance
    const attendance = await Attendance.findOne({ userId, date: today });
    if (!attendance || !attendance.checkIn || !attendance.checkIn.time) {
      return res.status(400).json({
        success: false,
        message: "No check-in record found for today"
      });
    }

    if (attendance.checkOut && attendance.checkOut.time) {
      return res.status(400).json({
        success: false,
        message: "Already checked out today",
        checkOutTime: attendance.checkOut.time
      });
    }

    const checkOutTime = new Date();
    const { location, notes } = req.body;

    attendance.checkOut = {
      time: checkOutTime,
      location: location || 'Office',
      ipAddress: req.ip,
      deviceInfo: req.headers['user-agent']
    };

    if (notes) {
      attendance.notes = attendance.notes ? `${attendance.notes}\n${notes}` : notes;
    }

    // Calculate working hours
    const diffInMs = checkOutTime - attendance.checkIn.time;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    attendance.workingHours = diffInMinutes;

    await attendance.save();

    const workingHoursFormatted = `${Math.floor(diffInMinutes / 60)}h ${diffInMinutes % 60}m`;

    res.status(200).json({
      success: true,
      message: `Checked out successfully at ${checkOutTime.toLocaleTimeString()}`,
      attendance: {
        id: attendance._id,
        checkInTime: attendance.checkIn.time,
        checkOutTime: attendance.checkOut.time,
        workingHours: workingHoursFormatted,
        totalMinutes: attendance.workingHours
      }
    });

  } catch (error) {
    console.error("Check-out error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check out"
    });
  }
});

// Mark as Absent
router.post("/attendance/mark-absent", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { reason, date } = req.body;
    const attendanceDate = date || new Date().toISOString().split('T')[0];
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const existingAttendance = await Attendance.findOne({ userId, date: attendanceDate });
    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: "Attendance already marked for this date"
      });
    }

    const attendance = new Attendance({
      userId,
      username: user.username,
      email: user.email,
      date: attendanceDate,
      status: 'absent',
      notes: `Absent - Reason: ${reason}`,
      absentReason: reason
    });

    await attendance.save();

    res.status(200).json({
      success: true,
      message: "Successfully marked as absent",
      attendance: {
        id: attendance._id,
        date: attendance.date,
        status: attendance.status,
        reason: reason
      }
    });

  } catch (error) {
    console.error("Mark absent error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark absent"
    });
  }
});

// Apply for Leave (Updated with Approval System)
router.post("/attendance/apply-leave", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { reason, date, leaveType } = req.body;
    const leaveDate = date || new Date().toISOString().split('T')[0];
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const existingAttendance = await Attendance.findOne({ userId, date: leaveDate });
    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: "Attendance already marked for this date"
      });
    }

    const attendance = new Attendance({
      userId,
      username: user.username,
      email: user.email,
      date: leaveDate,
      status: 'leave',
      notes: `Leave Application - Reason: ${reason}`,
      leaveReason: reason,
      leaveType: leaveType || 'other',
      isApproved: null, // null = pending
      createdBy: userId
    });

    await attendance.save();

    res.status(200).json({
      success: true,
      message: "Leave application submitted successfully. Waiting for admin approval.",
      attendance: {
        id: attendance._id,
        date: attendance.date,
        status: attendance.status,
        reason: reason,
        approvalStatus: 'pending'
      }
    });

  } catch (error) {
    console.error("Apply leave error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to apply for leave"
    });
  }
});

// Change Status Route
router.post("/attendance/change-status", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, reason, date } = req.body;
    const attendanceDate = date || new Date().toISOString().split('T')[0];
    
    // Validate status
    const validStatuses = ['present', 'absent', 'late', 'half-day', 'leave'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be one of: present, absent, late, half-day, leave"
      });
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Find existing attendance record
    let attendance = await Attendance.findOne({ userId, date: attendanceDate });
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "No attendance record found for this date"
      });
    }

    // Store old status for logging
    const oldStatus = attendance.status;

    // Update status and add reason to notes
    attendance.status = status;
    attendance.notes = attendance.notes ? 
      `${attendance.notes}\nStatus changed from '${oldStatus}' to '${status}' - Reason: ${reason}` : 
      `Status changed from '${oldStatus}' to '${status}' - Reason: ${reason}`;

    // Handle specific status changes
    if (status === 'absent' || status === 'leave') {
      // If changing to absent/leave, clear check-in/out data
      attendance.checkIn = undefined;
      attendance.checkOut = undefined;
      attendance.workingHours = 0;
      
      if (status === 'absent') {
        attendance.absentReason = reason;
      } else {
        attendance.leaveReason = reason;
        attendance.isApproved = null; // Reset to pending if changing to leave
      }
    }

    await attendance.save();

    res.status(200).json({
      success: true,
      message: `Status successfully changed from '${oldStatus}' to '${status}'`,
      attendance: {
        id: attendance._id,
        date: attendance.date,
        oldStatus: oldStatus,
        newStatus: attendance.status,
        reason: reason
      }
    });

  } catch (error) {
    console.error("Change status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to change status"
    });
  }
});

// Get Today's Attendance Status (Updated)
router.get("/attendance/today", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    
    const attendance = await Attendance.findOne({ userId, date: today });
    
    if (!attendance) {
      return res.status(200).json({
        success: true,
        attendance: null,
        status: 'not-checked-in'
      });
    }

    let status = 'not-checked-in';
    
    if (attendance.status === 'absent') {
      status = 'absent';
    } else if (attendance.status === 'leave') {
      status = 'leave';
    } else if (attendance.checkIn && attendance.checkIn.time) {
      if (attendance.checkOut && attendance.checkOut.time) {
        status = 'checked-out';
      } else {
        status = 'checked-in';
      }
    }

    const response = {
      success: true,
      attendance: {
        id: attendance._id,
        date: attendance.date,
        checkIn: attendance.checkIn,
        checkOut: attendance.checkOut,
        workingHours: attendance.workingHours,
        status: attendance.status,
        notes: attendance.notes,
        absentReason: attendance.absentReason,
        leaveReason: attendance.leaveReason,
        leaveType: attendance.leaveType,
        isApproved: attendance.isApproved,
        approvedBy: attendance.approvedBy,
        approvalDate: attendance.approvalDate,
        approvalNotes: attendance.approvalNotes
      },
      status: status
    };

    res.status(200).json(response);

  } catch (error) {
    console.error("Get today attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get attendance status"
    });
  }
});

// Get User's Attendance History
router.get("/attendance/history", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, month, year } = req.query;
    
    let query = { userId };
    
    // Filter by month/year if provided
    if (month && year) {
      const startDate = `${year}-${month.padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      query.date = { $gte: startDate, $lte: endDate };
    }

    const attendance = await Attendance.find(query)
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Attendance.countDocuments(query);

    res.status(200).json({
      success: true,
      attendance,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error("Get attendance history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get attendance history"
    });
  }
});

// Admin: Approve/Reject Leave
router.post("/attendance/admin/approve-leave", async (req, res) => {
  try {
    // Custom authentication for admin endpoints
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token required"
      });
    }

    // Verify the token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(403).json({
        success: false,
        message: "Invalid or expired token"
      });
    }

    const { attendanceId, isApproved, approvalNotes } = req.body;

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found"
      });
    }

    if (attendance.status !== 'leave') {
      return res.status(400).json({
        success: false,
        message: "This is not a leave request"
      });
    }

    attendance.isApproved = isApproved;
    attendance.approvedBy = decoded.id;
    attendance.approvalDate = new Date();
    attendance.approvalNotes = approvalNotes || '';

    if (!isApproved) {
      // If rejected, remove the attendance record
      await Attendance.findByIdAndDelete(attendanceId);
      
      res.status(200).json({
        success: true,
        message: "Leave request rejected and removed",
        action: 'rejected'
      });
    } else {
      await attendance.save();
      
      res.status(200).json({
        success: true,
        message: "Leave request approved successfully",
        attendance: {
          id: attendance._id,
          status: attendance.status,
          approvalStatus: 'approved'
        }
      });
    }

  } catch (error) {
    console.error("Approve leave error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process leave approval"
    });
  }
});

// Admin: Get Pending Leave Requests
router.get("/attendance/admin/pending-leaves", async (req, res) => {
  try {
    // Custom authentication for admin endpoints
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token required"
      });
    }

    // Verify the token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(403).json({
        success: false,
        message: "Invalid or expired token"
      });
    }

    // Find pending leave requests
    const pendingLeaves = await Attendance.find({
      status: 'leave',
      isApproved: null
    }).sort({ createdAt: -1 });

    // Manually fetch user details for each leave since populate might fail
    const leavesWithUserDetails = await Promise.all(
      pendingLeaves.map(async (leave) => {
        try {
          const user = await User.findById(leave.userId, 'username email');
          return {
            ...leave.toObject(),
            userDetails: user || { username: leave.username, email: leave.email }
          };
        } catch (err) {
          console.error('Error fetching user details for leave:', leave._id, err);
          return {
            ...leave.toObject(),
            userDetails: { username: leave.username, email: leave.email }
          };
        }
      })
    );

    res.status(200).json({
      success: true,
      pendingLeaves: leavesWithUserDetails,
      count: leavesWithUserDetails.length
    });

  } catch (error) {
    console.error("Get pending leaves error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get pending leave requests"
    });
  }
});

// ADMIN ROUTES - Get All Attendance Records
router.get("/attendance/admin/all", authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only."
      });
    }

    const { page = 1, limit = 20, date, userId, status } = req.query;
    
    let query = {};
    
    if (date) {
      query.date = date;
    }
    
    if (userId) {
      query.userId = userId;
    }
    
    if (status) {
      query.status = status;
    }

    const attendance = await Attendance.find(query)
      .populate('userId', 'username email')
      .sort({ date: -1, 'checkIn.time': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Attendance.countDocuments(query);

    res.status(200).json({
      success: true,
      attendance,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      },
      totalRecords: total
    });

  } catch (error) {
    console.error("Get all attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get attendance records"
    });
  }
});

// Get Today's Attendance Summary (Admin only)
router.get("/attendance/admin/today-summary", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only."
      });
    }

    const today = new Date().toISOString().split('T')[0];
    
    const todayAttendance = await Attendance.find({ date: today })
      .populate('userId', 'username email')
      .sort({ 'checkIn.time': 1 });

    const totalUsers = await User.countDocuments({ role: 'user', verified: true });
    
    const summary = {
      totalEmployees: totalUsers,
      present: todayAttendance.filter(a => a.checkIn && a.checkIn.time).length,
      late: todayAttendance.filter(a => a.status === 'late').length,
      checkedOut: todayAttendance.filter(a => a.checkOut && a.checkOut.time).length,
      stillWorking: todayAttendance.filter(a => a.checkIn && a.checkIn.time && (!a.checkOut || !a.checkOut.time)).length,
      absent: todayAttendance.filter(a => a.status === 'absent').length,
      leave: todayAttendance.filter(a => a.status === 'leave' && a.isApproved === true).length,
      pendingLeave: todayAttendance.filter(a => a.status === 'leave' && a.isApproved === null).length,
      notMarked: totalUsers - todayAttendance.length
    };

    res.status(200).json({
      success: true,
      date: today,
      summary,
      attendance: todayAttendance
    });

  } catch (error) {
    console.error("Get today summary error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get today's attendance summary"
    });
  }
});

module.exports = router;