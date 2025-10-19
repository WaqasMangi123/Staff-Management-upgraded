const express = require("express");
const router = express.Router();
const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const UserProfile = require("../models/userprofile");
const Attendance = require("../models/attendance");
console.log("UserProfile model loaded:", UserProfile.modelName);
require("dotenv").config();

// Environment Variables
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || `"Staff Management" <${EMAIL_USER}>`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || EMAIL_USER;
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Debug email configuration on startup
console.log("📧 Email Configuration:");
console.log("EMAIL_USER:", EMAIL_USER ? "✓ Set" : "❌ Not set");
console.log("EMAIL_PASS:", EMAIL_PASS ? "✓ Set" : "❌ Not set");
console.log("ADMIN_EMAIL:", ADMIN_EMAIL);
console.log("EMAIL_FROM:", EMAIL_FROM);

// AUTHENTICATION MIDDLEWARE - MOVED TO TOP
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
      return res.status(403).json({
        success: false,
        message: "Invalid or expired token"
      });
    }
    req.user = user;
    next();
  });
};

// Enhanced Nodemailer Setup with Render-compatible configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: parseInt(process.env.EMAIL_PORT) || 465,
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: { 
    user: EMAIL_USER, 
    pass: EMAIL_PASS 
  },
  tls: {
    rejectUnauthorized: false,
    ciphers: 'SSLv3'
  },
  connectionTimeout: 30000, // 30 seconds for slow connections
  greetingTimeout: 15000, // 15 seconds
  socketTimeout: 30000, // 30 seconds
  debug: process.env.NODE_ENV === 'development', // Enable debug in development
  logger: process.env.NODE_ENV === 'development' // Enable logger in development
});

// Test transporter connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email transporter verification failed:', error.message);
  } else {
    console.log('✅ Email server is ready to send messages');
  }
});

// Helper Functions
const generateVerificationCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendVerificationEmail = async (email, verificationCode) => {
  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
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
    console.log('✅ Verification email sent to:', email);
  } catch (err) {
    console.error("❌ Email sending error:", err);
    throw new Error("Failed to send verification email");
  }
};

// IMPROVED: Send Leave Application Email to Admin with timeout protection
const sendLeaveApplicationEmail = async (userDetails, leaveDetails) => {
  return new Promise((resolve) => {
    // Set a timeout to prevent hanging
    const emailTimeout = setTimeout(() => {
      console.log('⚠️ Email sending timeout - resolving anyway');
      resolve();
    }, 15000); // 15 second timeout

    const sendEmail = async () => {
      try {
        const leaveDate = new Date(leaveDetails.date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        const daysUntil = Math.ceil((new Date(leaveDetails.date) - new Date()) / (1000 * 60 * 60 * 24));
        const urgencyColor = daysUntil <= 2 ? '#dc3545' : daysUntil <= 7 ? '#ffc107' : '#28a745';
        const urgencyText = daysUntil <= 2 ? 'URGENT' : daysUntil <= 7 ? 'SOON' : 'ADVANCE';

        await transporter.sendMail({
          from: EMAIL_FROM,
          to: ADMIN_EMAIL,
          subject: `🏖️ Leave Application - ${userDetails.name || userDetails.username} (${urgencyText})`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
              <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 30px;">
                  <h1 style="color: #2563eb; margin: 0; font-size: 28px;">📋 New Leave Application</h1>
                  <div style="background-color: ${urgencyColor}; color: white; padding: 8px 15px; border-radius: 20px; display: inline-block; margin-top: 10px; font-weight: bold; font-size: 12px;">
                    ${urgencyText} - ${daysUntil} day(s) until leave
                  </div>
                </div>

                <!-- Employee Details -->
                <div style="background-color: #e7f3ff; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #2563eb;">
                  <h3 style="color: #2563eb; margin: 0 0 15px 0; font-size: 18px;">👤 Employee Information</h3>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                      <strong style="color: #495057;">Name:</strong><br>
                      <span style="font-size: 16px;">${userDetails.name || userDetails.username}</span>
                    </div>
                    <div>
                      <strong style="color: #495057;">Email:</strong><br>
                      <span style="font-size: 16px;">${userDetails.email}</span>
                    </div>
                    <div>
                      <strong style="color: #495057;">Department:</strong><br>
                      <span style="font-size: 16px;">${userDetails.department || 'Not Set'}</span>
                    </div>
                    <div>
                      <strong style="color: #495057;">Position:</strong><br>
                      <span style="font-size: 16px;">${userDetails.jobTitle || 'Not Set'}</span>
                    </div>
                  </div>
                </div>

                <!-- Leave Details -->
                <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #ffc107;">
                  <h3 style="color: #856404; margin: 0 0 15px 0; font-size: 18px;">📅 Leave Details</h3>
                  <div style="margin-bottom: 15px;">
                    <strong style="color: #495057;">Leave Date:</strong><br>
                    <span style="font-size: 18px; font-weight: bold; color: #856404;">${leaveDate}</span>
                  </div>
                  <div style="margin-bottom: 15px;">
                    <strong style="color: #495057;">Leave Type:</strong><br>
                    <span style="font-size: 16px; background-color: #ffc107; color: #212529; padding: 4px 8px; border-radius: 4px; font-weight: bold;">
                      ${leaveDetails.leaveType.charAt(0).toUpperCase() + leaveDetails.leaveType.slice(1)} Leave
                    </span>
                  </div>
                  <div style="margin-bottom: 15px;">
                    <strong style="color: #495057;">Reason:</strong><br>
                    <div style="background-color: white; padding: 10px; border-radius: 4px; border: 1px solid #ffeaa7; margin-top: 5px;">
                      <span style="font-size: 16px; line-height: 1.5;">${leaveDetails.reason}</span>
                    </div>
                  </div>
                  <div>
                    <strong style="color: #495057;">Application Submitted:</strong><br>
                    <span style="font-size: 14px; color: #6c757d;">${new Date().toLocaleString()}</span>
                  </div>
                </div>

                <!-- Action Required -->
                <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #28a745;">
                  <h3 style="color: #155724; margin: 0 0 15px 0; font-size: 18px;">⚡ Action Required</h3>
                  <p style="margin: 0 0 15px 0; color: #155724; font-size: 16px;">
                    Please review and approve/reject this leave application in the admin dashboard.
                  </p>
                  <div style="text-align: center; margin-top: 20px;">
                    <a href="${FRONTEND_URL}/admin/attendance" 
                       style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">
                      📊 View in Admin Dashboard
                    </a>
                  </div>
                </div>

                ${daysUntil <= 7 ? `
                <!-- Priority Indicator -->
                <div style="background-color: #f8d7da; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc3545;">
                  <h4 style="color: #721c24; margin: 0 0 10px 0;">⚠️ Priority Notice</h4>
                  <p style="margin: 0; color: #721c24; font-size: 14px;">
                    This leave is scheduled for ${daysUntil <= 2 ? 'very soon' : 'next week'}. 
                    Please review and respond promptly to allow for proper planning.
                  </p>
                </div>
                ` : ''}

                <!-- Footer -->
                <div style="text-align: center; border-top: 1px solid #dee2e6; padding-top: 20px; margin-top: 30px;">
                  <p style="margin: 0; color: #6c757d; font-size: 14px;">
                    This is an automated notification from the Staff Management System.<br>
                    For any issues, please contact the system administrator.
                  </p>
                </div>
              </div>
            </div>
          `,
        });

        clearTimeout(emailTimeout);
        console.log(`✅ Leave application notification sent to admin for ${userDetails.username}`);
        resolve();
        
      } catch (err) {
        clearTimeout(emailTimeout);
        console.error("❌ Failed to send leave application email:", err.message);
        resolve(); // Don't throw error to prevent leave application from failing
      }
    };

    sendEmail();
  });
};

// IMPROVED: Send Leave Status Update Email to User with timeout protection
const sendLeaveStatusEmail = async (userEmail, userName, leaveDetails, isApproved, adminNotes) => {
  return new Promise((resolve) => {
    const emailTimeout = setTimeout(() => {
      console.log('⚠️ Status email timeout - resolving anyway');
      resolve();
    }, 15000);

    const sendEmail = async () => {
      try {
        const leaveDate = new Date(leaveDetails.date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        const statusColor = isApproved ? '#28a745' : '#dc3545';
        const statusText = isApproved ? 'APPROVED' : 'REJECTED';
        const statusIcon = isApproved ? '✅' : '❌';

        await transporter.sendMail({
          from: EMAIL_FROM,
          to: userEmail,
          subject: `${statusIcon} Leave Request ${statusText} - ${leaveDate}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
              <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 30px;">
                  <h1 style="color: ${statusColor}; margin: 0; font-size: 28px;">${statusIcon} Leave Request ${statusText}</h1>
                </div>

                <!-- Status Box -->
                <div style="background-color: ${statusColor}; color: white; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 25px;">
                  <h2 style="margin: 0; font-size: 24px;">Your leave request has been ${statusText.toLowerCase()}</h2>
                </div>

                <!-- Leave Details -->
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                  <h3 style="color: #495057; margin: 0 0 15px 0;">📋 Leave Details</h3>
                  <div style="margin-bottom: 10px;">
                    <strong>Date:</strong> ${leaveDate}
                  </div>
                  <div style="margin-bottom: 10px;">
                    <strong>Type:</strong> ${leaveDetails.leaveType.charAt(0).toUpperCase() + leaveDetails.leaveType.slice(1)} Leave
                  </div>
                  <div style="margin-bottom: 10px;">
                    <strong>Your Reason:</strong> ${leaveDetails.reason}
                  </div>
                  <div>
                    <strong>Decision Date:</strong> ${new Date().toLocaleDateString()}
                  </div>
                </div>

                ${adminNotes ? `
                <!-- Admin Notes -->
                <div style="background-color: #e9ecef; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                  <h3 style="color: #495057; margin: 0 0 15px 0;">💬 Admin Notes</h3>
                  <p style="margin: 0; font-style: italic; color: #6c757d;">"${adminNotes}"</p>
                </div>
                ` : ''}

                <!-- Footer -->
                <div style="text-align: center; border-top: 1px solid #dee2e6; padding-top: 20px;">
                  <p style="margin: 0; color: #6c757d; font-size: 14px;">
                    This notification was sent from the Staff Management System.<br>
                    For questions, please contact your supervisor or HR department.
                  </p>
                </div>
              </div>
            </div>
          `,
        });

        clearTimeout(emailTimeout);
        console.log(`✅ Leave status email sent to ${userEmail} - Status: ${statusText}`);
        resolve();
        
      } catch (err) {
        clearTimeout(emailTimeout);
        console.error("❌ Failed to send leave status email:", err.message);
        resolve();
      }
    };

    sendEmail();
  });
};

// ADD: Simple leave email test endpoint
router.post("/test-leave-email", async (req, res) => {
  try {
    const { type = 'application' } = req.body; // 'application' or 'status'
    
    console.log(`🧪 Testing ${type} email...`);
    
    const testUserDetails = {
      username: 'TestUser',
      email: ADMIN_EMAIL, // Send to admin email for testing
      name: 'Test Employee',
      department: 'IT Department',
      jobTitle: 'Developer'
    };

    const testLeaveDetails = {
      date: '2025-10-25',
      leaveType: 'vacation',
      reason: 'This is a test leave application to verify email functionality'
    };

    if (type === 'application') {
      console.log('📧 Sending test leave application email...');
      await sendLeaveApplicationEmail(testUserDetails, testLeaveDetails);
      res.json({ 
        success: true, 
        message: "Test leave application email sent successfully",
        sentTo: ADMIN_EMAIL
      });
    } else {
      console.log('📧 Sending test leave status email...');
      await sendLeaveStatusEmail(
        ADMIN_EMAIL,
        'TestUser',
        testLeaveDetails,
        true, // approved
        'This is a test approval email'
      );
      res.json({ 
        success: true, 
        message: "Test leave status email sent successfully",
        sentTo: ADMIN_EMAIL
      });
    }
    
  } catch (error) {
    console.error("❌ Test leave email failed:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.toString()
    });
  }
});

// ADD: Test basic email functionality
router.post("/test-email", async (req, res) => {
  try {
    console.log("🧪 Testing email configuration...");
    console.log("EMAIL_USER:", EMAIL_USER);
    console.log("ADMIN_EMAIL:", ADMIN_EMAIL);
    console.log("EMAIL_FROM:", EMAIL_FROM);
    
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: ADMIN_EMAIL,
      subject: "🧪 Test Email - Staff Management System",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #28a745;">✅ Email Test Successful!</h2>
          <p>This test email confirms that your email configuration is working correctly.</p>
          <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>From:</strong> ${EMAIL_FROM}</p>
          <p><strong>To:</strong> ${ADMIN_EMAIL}</p>
        </div>
      `
    });
    
    res.json({ 
      success: true, 
      message: "Test email sent successfully",
      emailConfig: {
        from: EMAIL_FROM,
        to: ADMIN_EMAIL,
        timestamp: new Date().toLocaleString()
      }
    });
  } catch (error) {
    console.error("❌ Test email failed:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      emailConfig: {
        from: EMAIL_FROM,
        to: ADMIN_EMAIL,
        userConfigured: !!EMAIL_USER,
        passConfigured: !!EMAIL_PASS
      }
    });
  }
});

// Helper function to get user's working hours from profile
const getUserWorkingHours = async (userId) => {
  try {
    const profile = await UserProfile.findOne({ userId });
    if (profile && profile.workingHours && profile.workingHours.start) {
      return {
        start: profile.workingHours.start,
        end: profile.workingHours.end
      };
    }
    return {
      start: '09:00',
      end: '17:00'
    };
  } catch (error) {
    console.error('Error getting user working hours:', error);
    return {
      start: '09:00',
      end: '17:00'
    };
  }
};

// Helper function to check if user should be auto-marked absent
const shouldAutoMarkAbsent = async (userId) => {
  try {
    const workingHours = await getUserWorkingHours(userId);
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const [startHour, startMinute] = workingHours.start.split(':').map(Number);
    const workStartMinutes = startHour * 60 + startMinute;
    const graceEndMinutes = workStartMinutes + 10;
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const currentMinutes = currentHour * 60 + currentMinute;
    
    return currentMinutes > graceEndMinutes;
  } catch (error) {
    console.error('Error checking auto absent condition:', error);
    return false;
  }
};

// Helper function to determine if check-in should be marked as absent instead of late
const shouldMarkAsAbsent = async (userId) => {
  try {
    const workingHours = await getUserWorkingHours(userId);
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const [startHour, startMinute] = workingHours.start.split(':').map(Number);
    const workStartMinutes = startHour * 60 + startMinute;
    const absentThresholdMinutes = workStartMinutes + 120; // 2 hours after start time
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const currentMinutes = currentHour * 60 + currentMinute;
    
    return currentMinutes > absentThresholdMinutes;
  } catch (error) {
    console.error('Error checking absent condition:', error);
    return false;
  }
};

// Auto-mark absent users who haven't checked in after grace period
const autoMarkAbsentUsers = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const allUsers = await User.find({ 
      role: 'user', 
      verified: true 
    }).select('_id username email');
    
    for (const user of allUsers) {
      const existingAttendance = await Attendance.findOne({ 
        userId: user._id, 
        date: today 
      });
      
      if (!existingAttendance) {
        const shouldMarkAbsent = await shouldAutoMarkAbsent(user._id);
        
        if (shouldMarkAbsent) {
          const workingHours = await getUserWorkingHours(user._id);
          
          const attendance = new Attendance({
            userId: user._id,
            username: user.username,
            email: user.email,
            date: today,
            status: 'absent',
            notes: `Auto-marked absent - No check-in after ${workingHours.start} + 10 min grace period`,
            absentReason: 'Auto-marked for late arrival',
            isManualEntry: false,
            createdBy: null
          });
          
          await attendance.save();
          console.log(`Auto-marked ${user.username} as absent for ${today}`);
        }
      }
    }
  } catch (error) {
    console.error('Error in auto-mark absent process:', error);
  }
};

// Middleware to update lastActive timestamp and run auto-absent check
router.use(async (req, res, next) => {
  if (req.user) {
    try {
      await User.findByIdAndUpdate(req.user.id, { lastActive: new Date() });
    } catch (err) {
      console.error("Error updating lastActive:", err);
    }
  }
  
  if (Math.random() < 0.3) {
    autoMarkAbsentUsers().catch(err => console.error('Auto-absent check failed:', err));
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
      password: trimmedPassword,
      verified: false,
      verificationCode,
      verificationCodeExpires: Date.now() + 10 * 60 * 1000,
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

    user.verified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

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

    const isPasswordValid = await user.comparePassword(trimmedPassword);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false,
        message: "Incorrect password. Please try again."
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { 
        id: user._id,
        email: user.email,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

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

    const verificationCode = generateVerificationCode();
    user.verificationCode = verificationCode;
    user.verificationCodeExpires = Date.now() + 10 * 60 * 1000;
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

    const resetToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1h" });
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const resetUrl = `https://parksy.uk/#/reset-password/${resetToken}`;
    await transporter.sendMail({
      from: EMAIL_FROM,
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

    const isSamePassword = await user.comparePassword(newPassword.trim());
    if (isSamePassword) {
      return res.status(400).json({ 
        success: false,
        message: "New password must be different from your current password" 
      });
    }

    user.password = newPassword.trim();
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    await transporter.sendMail({
      from: EMAIL_FROM,
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

// 🔹 Get User Profile
router.get("/profile/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    const profile = await UserProfile.findOne({ userId });
    
    res.status(200).json({
      success: true,
      profile: profile || null
    });

  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile"
    });
  }
});

// 🔹 Update/Create User Profile
router.post("/update-profile", async (req, res) => {
  try {
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

    if (!userId || !name || !phone || !department || !jobTitle || !shift) {
      return res.status(400).json({
        success: false,
        message: "Required fields: name, phone, department, jobTitle, shift"
      });
    }

    if (!workingHours || !workingHours.start || !workingHours.end) {
      return res.status(400).json({
        success: false,
        message: "Working hours start and end times are required"
      });
    }

    if (!emergencyContact || !emergencyContact.name || !emergencyContact.relationship || !emergencyContact.phone) {
      return res.status(400).json({
        success: false,
        message: "Emergency contact information is required"
      });
    }

    let profile = await UserProfile.findOne({ userId });

    if (profile) {
      profile.name = name.trim();
      profile.phone = phone.trim();
      profile.profilePicture = profilePicture || null;
      profile.department = department;
      profile.jobTitle = jobTitle;
      profile.shift = shift;
      profile.workingHours = workingHours;
      profile.skills = skills || [];
      profile.yearsWorked = parseInt(yearsWorked) || 0;
      profile.specialTraining = specialTraining || [];
      profile.shiftFlexibility = shiftFlexibility || false;
      profile.emergencyContact = {
        name: emergencyContact.name.trim(),
        relationship: emergencyContact.relationship.trim(),
        phone: emergencyContact.phone.trim()
      };
      profile.notes = notes || '';
      profile.profileComplete = true;
      profile.lastUpdated = new Date();

      await profile.save();
    } else {
      profile = new UserProfile({
        userId,
        name: name.trim(),
        phone: phone.trim(),
        profilePicture: profilePicture || null,
        department,
        jobTitle,
        shift,
        workingHours,
        skills: skills || [],
        yearsWorked: parseInt(yearsWorked) || 0,
        specialTraining: specialTraining || [],
        shiftFlexibility: shiftFlexibility || false,
        emergencyContact: {
          name: emergencyContact.name.trim(),
          relationship: emergencyContact.relationship.trim(),
          phone: emergencyContact.phone.trim()
        },
        notes: notes || '',
        profileComplete: true
      });

      await profile.save();
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      profile: {
        id: profile._id,
        userId: profile.userId,
        name: profile.name,
        department: profile.department,
        jobTitle: profile.jobTitle,
        profileComplete: profile.profileComplete
      }
    });

  } catch (error) {
    console.error("Update profile error:", error);
    
    if (error.name === 'ValidationError') {
      const errorMessages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: errorMessages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to update profile"
    });
  }
});

// 🔹 ATTENDANCE ROUTES

// Add test endpoint for debugging
router.get("/attendance/debug-auto-absent", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const workingHours = await getUserWorkingHours(userId);
    const shouldMark = await shouldAutoMarkAbsent(userId);
    const shouldBeAbsent = await shouldMarkAsAbsent(userId);
    
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const [startHour, startMinute] = workingHours.start.split(':').map(Number);
    const workStartMinutes = startHour * 60 + startMinute;
    const graceEndMinutes = workStartMinutes + 10;
    const absentThresholdMinutes = workStartMinutes + 120;
    
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const currentMinutes = currentHour * 60 + currentMinute;
    
    const debugInfo = {
      userId: userId,
      workingHours: workingHours,
      currentTime: currentTime,
      serverTime: now.toLocaleString(),
      shouldAutoMarkAbsent: shouldMark,
      shouldMarkAsAbsent: shouldBeAbsent,
      calculations: {
        workStartMinutes,
        graceEndMinutes,
        absentThresholdMinutes,
        currentMinutes,
        minutesAfterStart: currentMinutes - workStartMinutes,
        isAfterGrace: currentMinutes > graceEndMinutes,
        isAfterAbsentThreshold: currentMinutes > absentThresholdMinutes
      }
    };
    
    res.json({
      success: true,
      debug: debugInfo
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Force run auto-absent check (admin only)
router.post("/attendance/force-auto-absent", authenticateToken, async (req, res) => {
  try {
    await autoMarkAbsentUsers();
    
    res.status(200).json({
      success: true,
      message: "Auto-absent check completed successfully",
      timestamp: new Date().toLocaleString()
    });

  } catch (error) {
    console.error("Force auto-absent error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to run auto-absent check",
      error: error.message
    });
  }
});

// 🔹 Smart Check-in with enhanced absent/late logic
router.post("/attendance/check-in", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const existingAttendance = await Attendance.findOne({ userId, date: today });
    if (existingAttendance) {
      if (existingAttendance.status === 'absent' && !existingAttendance.checkIn) {
        const shouldBeAbsent = await shouldMarkAsAbsent(userId);
        
        if (shouldBeAbsent) {
          return res.status(400).json({
            success: false,
            message: "Cannot check in - marked as absent due to excessive delay. Please contact admin for manual attendance correction."
          });
        }
      }
      
      if (existingAttendance.status === 'leave') {
        return res.status(400).json({
          success: false,
          message: "Cannot check in - you have approved leave for today"
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
    
    const workingHours = await getUserWorkingHours(userId);
    
    const [workStartHour, workStartMinute] = workingHours.start.split(':').map(Number);
    const workStartMinutes = workStartHour * 60 + workStartMinute;
    const checkInHour = checkInTime.getHours();
    const checkInMinutes = checkInTime.getMinutes();
    const checkInTotalMinutes = checkInHour * 60 + checkInMinutes;
    
    const delayMinutes = checkInTotalMinutes - workStartMinutes;
    const delayHours = Math.floor(delayMinutes / 60);
    const delayMins = delayMinutes % 60;
    
    let status = 'present';
    let message = `Checked in successfully at ${checkInTime.toLocaleTimeString()}`;
    
    if (delayMinutes > 120) {
      let attendance;
      if (existingAttendance) {
        attendance = existingAttendance;
        attendance.status = 'absent';
        attendance.absentReason = `Excessive delay - ${delayHours}h ${delayMins}m late`;
        attendance.notes = `Attempted check-in at ${checkInTime.toLocaleTimeString()} - marked absent due to excessive delay`;
        attendance.isManualEntry = true;
      } else {
        attendance = new Attendance({
          userId,
          username: user.username,
          email: user.email,
          date: today,
          status: 'absent',
          absentReason: `Excessive delay - ${delayHours}h ${delayMins}m late`,
          notes: `Attempted check-in at ${checkInTime.toLocaleTimeString()} - marked absent due to excessive delay`,
          isManualEntry: true
        });
      }
      
      await attendance.save();
      
      return res.status(400).json({
        success: false,
        message: `Cannot check in - marked as absent due to excessive delay (${delayHours}h ${delayMins}m late). Please contact admin for manual correction.`,
        attendance: {
          id: attendance._id,
          status: 'absent',
          reason: attendance.absentReason,
          delayInfo: {
            delayMinutes,
            delayHours,
            delayMins
          }
        }
      });
      
    } else if (delayMinutes > 10) {
      status = 'late';
      message = `Checked in late at ${checkInTime.toLocaleTimeString()} (${delayHours > 0 ? `${delayHours}h ` : ''}${delayMins}m late)`;
    }

    let attendance;
    if (existingAttendance) {
      attendance = existingAttendance;
      attendance.checkIn = {
        time: checkInTime,
        location: location || 'Office',
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent']
      };
      attendance.status = status;
      if (status === 'late') {
        attendance.notes = `Late arrival - ${delayHours > 0 ? `${delayHours}h ` : ''}${delayMins}m after start time`;
      }
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
        status: status,
        notes: status === 'late' ? `Late arrival - ${delayHours > 0 ? `${delayHours}h ` : ''}${delayMins}m after start time` : (notes || '')
      });
    }

    await attendance.save();

    res.status(200).json({
      success: true,
      message: message,
      attendance: {
        id: attendance._id,
        checkInTime: attendance.checkIn.time,
        status: attendance.status,
        isLate: attendance.status === 'late',
        delayInfo: {
          delayMinutes,
          delayHours,
          delayMins
        },
        workingHours: workingHours
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

// 🔹 Enhanced Check-out
router.post("/attendance/check-out", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    
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

// 🔹 IMPROVED Apply for Leave with better error handling
router.post("/attendance/apply-leave", authenticateToken, async (req, res) => {
  try {
    console.log('📝 Processing leave application request...');
    const userId = req.user.id;
    const { reason, date, leaveType } = req.body;
    
    console.log('📝 Request data:', { userId, reason: reason?.substring(0, 50) + '...', date, leaveType });
    
    if (!reason || !date || !leaveType) {
      return res.status(400).json({
        success: false,
        message: "Reason, date, and leave type are required"
      });
    }
    
    const today = new Date().toISOString().split('T')[0];
    const leaveDate = new Date(date).toISOString().split('T')[0];
    
    console.log('📝 Date validation:', { today, leaveDate, isValid: leaveDate > today });
    
    if (leaveDate <= today) {
      return res.status(400).json({
        success: false,
        message: "Leave can only be applied for future dates. For today or past dates, contact your admin directly."
      });
    }
    
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

    console.log('💾 Saving attendance record...');
    const attendance = new Attendance({
      userId,
      username: user.username,
      email: user.email,
      date: leaveDate,
      status: 'leave',
      notes: `Leave Application - Type: ${leaveType}, Reason: ${reason}`,
      leaveReason: reason,
      leaveType: leaveType,
      isApproved: null,
      createdBy: userId
    });

    await attendance.save();
    console.log('✅ Attendance record saved successfully');

    const userProfile = await UserProfile.findOne({ userId });
    const userDetails = {
      username: user.username,
      email: user.email,
      name: userProfile?.name || user.username,
      department: userProfile?.department || 'Not Set',
      jobTitle: userProfile?.jobTitle || 'Not Set'
    };

    const leaveDetails = {
      date: leaveDate,
      leaveType: leaveType,
      reason: reason
    };

    // IMPROVED: Send response first, then send email in background
    res.status(200).json({
      success: true,
      message: "Leave application submitted successfully. Admin notification is being sent and you'll receive an email once reviewed.",
      attendance: {
        id: attendance._id,
        date: attendance.date,
        status: attendance.status,
        leaveType: leaveType,
        reason: reason,
        approvalStatus: 'pending'
      }
    });

    // Send email notification in background (non-blocking)
    console.log('📧 Sending email notification to admin...');
    setImmediate(async () => {
      try {
        await sendLeaveApplicationEmail(userDetails, leaveDetails);
        console.log(`✅ Leave application email sent to admin for ${user.username}`);
      } catch (emailError) {
        console.error("❌ Background email notification failed:", emailError);
      }
    });

  } catch (error) {
    console.error("❌ Apply leave error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to apply for leave: " + error.message
    });
  }
});

// 🔹 Manual Absent (for emergencies - same day only)
router.post("/attendance/mark-absent", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { reason } = req.body;
    const today = new Date().toISOString().split('T')[0];
    
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Reason is required for marking absent"
      });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const existingAttendance = await Attendance.findOne({ userId, date: today });
    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: "Attendance already marked for today"
      });
    }

    const attendance = new Attendance({
      userId,
      username: user.username,
      email: user.email,
      date: today,
      status: 'absent',
      notes: `Manual absent - Reason: ${reason}`,
      absentReason: reason,
      isManualEntry: true,
      createdBy: userId
    });

    await attendance.save();

    res.status(200).json({
      success: true,
      message: "Successfully marked as absent for today",
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

// 🔹 Get Today's Attendance Status with Real-time Auto-Absent Check
router.get("/attendance/today", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    
    let attendance = await Attendance.findOne({ userId, date: today });
    const workingHours = await getUserWorkingHours(userId);
    const shouldMarkAbsent = await shouldAutoMarkAbsent(userId);
    
    if (!attendance && shouldMarkAbsent) {
      const user = await User.findById(userId);
      if (user) {
        attendance = new Attendance({
          userId,
          username: user.username,
          email: user.email,
          date: today,
          status: 'absent',
          notes: `Auto-marked absent - No check-in after ${workingHours.start} + 10 min grace period`,
          absentReason: 'Auto-marked for late arrival',
          isManualEntry: false,
          createdBy: null
        });
        
        await attendance.save();
        console.log(`Real-time auto-marked ${user.username} as absent for ${today}`);
      }
    }
    
    if (!attendance) {
      return res.status(200).json({
        success: true,
        attendance: null,
        status: 'not-checked-in',
        workingHours: workingHours,
        shouldAutoMarkAbsent: shouldMarkAbsent,
        graceTimeInfo: {
          workStart: workingHours.start,
          gracePeriod: '10 minutes',
          graceEnd: `${workingHours.start.split(':')[0]}:${(parseInt(workingHours.start.split(':')[1]) + 10).toString().padStart(2, '0')}`,
          currentTime: new Date().toLocaleTimeString()
        }
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

    res.status(200).json({
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
        approvalNotes: attendance.approvalNotes,
        isAutoMarked: !attendance.isManualEntry && attendance.status === 'absent'
      },
      status: status,
      workingHours: workingHours,
      shouldAutoMarkAbsent: shouldMarkAbsent
    });

  } catch (error) {
    console.error("Get today attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get attendance status"
    });
  }
});

// 🔹 Get User's Attendance History
router.get("/attendance/history", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, month, year } = req.query;
    
    let query = { userId };
    
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

// 🔹 Enhanced Change Status (today only)
router.post("/attendance/change-status", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, reason, date } = req.body;
    const today = new Date().toISOString().split('T')[0];
    
    if (date !== today) {
      return res.status(400).json({
        success: false,
        message: "Status can only be changed for today"
      });
    }
    
    if (!status || !reason) {
      return res.status(400).json({
        success: false,
        message: "Status and reason are required"
      });
    }
    
    const validStatuses = ['present', 'absent', 'late', 'half-day', 'leave'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Valid options: present, absent, late, half-day, leave"
      });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    let attendance = await Attendance.findOne({ userId, date: today });
    
    if (!attendance) {
      attendance = new Attendance({
        userId,
        username: user.username,
        email: user.email,
        date: today,
        status: status,
        notes: `Status change: ${status} - Reason: ${reason}`,
        isManualEntry: true,
        createdBy: userId
      });
      
      if (status === 'absent') {
        attendance.absentReason = reason;
      } else if (status === 'leave') {
        attendance.leaveReason = reason;
        attendance.isApproved = null;
      }
    } else {
      const oldStatus = attendance.status;
      attendance.status = status;
      attendance.notes = attendance.notes ? 
        `${attendance.notes}\n--- Status Changed from ${oldStatus} to ${status} ---\nReason: ${reason}` : 
        `Status change: ${status} - Reason: ${reason}`;
      
      if (status === 'absent') {
        attendance.absentReason = reason;
        attendance.leaveReason = undefined;
        attendance.leaveType = undefined;
        attendance.isApproved = undefined;
      } else if (status === 'leave') {
        attendance.leaveReason = reason;
        attendance.isApproved = null;
        attendance.absentReason = undefined;
      } else {
        attendance.absentReason = undefined;
        attendance.leaveReason = undefined;
        attendance.leaveType = undefined;
        attendance.isApproved = undefined;
      }
      
      attendance.isManualEntry = true;
    }

    await attendance.save();

    res.status(200).json({
      success: true,
      message: `Status successfully changed to ${status}`,
      attendance: {
        id: attendance._id,
        date: attendance.date,
        status: attendance.status,
        reason: reason,
        isApproved: attendance.isApproved
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

// 🔹 Enhanced Admin: Approve/Reject Leave with Email Notifications
router.post("/attendance/admin/approve-leave", async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token required"
      });
    }

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

    if (typeof isApproved !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: "isApproved must be true or false"
      });
    }

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

    if (attendance.isApproved !== null) {
      return res.status(400).json({
        success: false,
        message: `Leave request has already been ${attendance.isApproved ? 'approved' : 'rejected'}`
      });
    }

    const adminUser = await User.findById(decoded.id);
    const leaveUser = await User.findById(attendance.userId);
    
    attendance.isApproved = isApproved;
    attendance.approvedBy = decoded.id;
    attendance.approvalDate = new Date();
    attendance.approvalNotes = approvalNotes || '';
    
    const approvalInfo = `\n--- ADMIN ACTION ---\n${isApproved ? 'APPROVED' : 'REJECTED'} by ${adminUser?.username || 'Admin'} on ${new Date().toLocaleString()}\nNotes: ${approvalNotes || 'None'}`;
    attendance.notes = (attendance.notes || '') + approvalInfo;

    if (!isApproved) {
      await Attendance.findByIdAndDelete(attendanceId);
      
      if (leaveUser && leaveUser.email) {
        setImmediate(async () => {
          try {
            await sendLeaveStatusEmail(
              leaveUser.email, 
              leaveUser.username, 
              {
                date: attendance.date,
                leaveType: attendance.leaveType,
                reason: attendance.leaveReason
              }, 
              false, 
              approvalNotes
            );
            console.log(`📧 Leave rejection email sent to ${leaveUser.username}`);
          } catch (emailError) {
            console.error("❌ Failed to send rejection email:", emailError);
          }
        });
      }
      
      res.status(200).json({
        success: true,
        message: "Leave request rejected and removed from records",
        action: 'rejected',
        adminAction: {
          approvedBy: adminUser?.username || 'Admin',
          approvalDate: new Date(),
          approvalNotes: approvalNotes || 'None'
        }
      });
    } else {
      await attendance.save();
      
      if (leaveUser && leaveUser.email) {
        setImmediate(async () => {
          try {
            await sendLeaveStatusEmail(
              leaveUser.email, 
              leaveUser.username, 
              {
                date: attendance.date,
                leaveType: attendance.leaveType,
                reason: attendance.leaveReason
              }, 
              true, 
              approvalNotes
            );
            console.log(`📧 Leave approval email sent to ${leaveUser.username}`);
          } catch (emailError) {
            console.error("❌ Failed to send approval email:", emailError);
          }
        });
      }
      
      res.status(200).json({
        success: true,
        message: "Leave request approved successfully",
        attendance: {
          id: attendance._id,
          status: attendance.status,
          approvalStatus: 'approved',
          leaveType: attendance.leaveType,
          leaveReason: attendance.leaveReason
        },
        adminAction: {
          approvedBy: adminUser?.username || 'Admin',
          approvalDate: attendance.approvalDate,
          approvalNotes: attendance.approvalNotes
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

// 🔹 Enhanced Admin: Get Pending Leave Requests
router.get("/attendance/admin/pending-leaves", async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token required"
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(403).json({
        success: false,
        message: "Invalid or expired token"
      });
    }

    const pendingLeaves = await Attendance.find({
      status: 'leave',
      isApproved: null
    }).sort({ createdAt: -1 });

    const leavesWithUserDetails = await Promise.all(
      pendingLeaves.map(async (leave) => {
        try {
          const user = await User.findById(leave.userId, 'username email');
          const profile = await UserProfile.findOne({ userId: leave.userId }, 'name department jobTitle');
          
          return {
            ...leave.toObject(),
            userDetails: {
              username: user?.username || leave.username,
              email: user?.email || leave.email,
              name: profile?.name || user?.username || leave.username,
              department: profile?.department || 'Not Set',
              jobTitle: profile?.jobTitle || 'Not Set'
            },
            daysUntilLeave: Math.ceil((new Date(leave.date) - new Date()) / (1000 * 60 * 60 * 24))
          };
        } catch (err) {
          console.error('Error fetching user details for leave:', leave._id, err);
          return {
            ...leave.toObject(),
            userDetails: { 
              username: leave.username, 
              email: leave.email,
              name: leave.username,
              department: 'Not Set',
              jobTitle: 'Not Set'
            },
            daysUntilLeave: Math.ceil((new Date(leave.date) - new Date()) / (1000 * 60 * 60 * 24))
          };
        }
      })
    );

    leavesWithUserDetails.sort((a, b) => a.daysUntilLeave - b.daysUntilLeave);

    res.status(200).json({
      success: true,
      pendingLeaves: leavesWithUserDetails,
      count: leavesWithUserDetails.length,
      summary: {
        total: leavesWithUserDetails.length,
        urgent: leavesWithUserDetails.filter(l => l.daysUntilLeave <= 2).length,
        thisWeek: leavesWithUserDetails.filter(l => l.daysUntilLeave <= 7).length
      }
    });

  } catch (error) {
    console.error("Get pending leaves error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get pending leave requests"
    });
  }
});

// 🔹 Admin: Get All Attendance Records
router.get("/attendance/admin/all", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only."
      });
    }

    const { page = 1, limit = 20, date, userId, status } = req.query;
    
    let query = {};
    
    if (date) query.date = date;
    if (userId) query.userId = userId;
    if (status) query.status = status;

    const attendance = await Attendance.find(query)
      .populate('userId', 'username email')
      .sort({ date: -1, 'checkIn.time': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Attendance.countDocuments(query);

    const enhancedAttendance = await Promise.all(
      attendance.map(async (record) => {
        const profile = await UserProfile.findOne({ userId: record.userId }, 'name department workingHours');
        return {
          ...record.toObject(),
          userProfile: profile ? {
            name: profile.name,
            department: profile.department,
            workingHours: profile.workingHours
          } : null
        };
      })
    );

    res.status(200).json({
      success: true,
      attendance: enhancedAttendance,
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

// 🔹 Enhanced Today's Attendance Summary (Admin only)
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
      autoAbsent: todayAttendance.filter(a => a.status === 'absent' && !a.isManualEntry).length,
      manualAbsent: todayAttendance.filter(a => a.status === 'absent' && a.isManualEntry).length,
      approvedLeave: todayAttendance.filter(a => a.status === 'leave' && a.isApproved === true).length,
      pendingLeave: todayAttendance.filter(a => a.status === 'leave' && a.isApproved === null).length,
      rejectedLeave: todayAttendance.filter(a => a.status === 'leave' && a.isApproved === false).length,
      notMarked: totalUsers - todayAttendance.length
    };

    const totalMarked = summary.present + summary.absent + summary.approvedLeave;
    summary.attendanceRate = totalUsers > 0 ? Math.round((totalMarked / totalUsers) * 100) : 0;

    res.status(200).json({
      success: true,
      date: today,
      summary,
      attendance: todayAttendance,
      insights: {
        punctualityRate: summary.present > 0 ? Math.round(((summary.present - summary.late) / summary.present) * 100) : 0,
        autoAbsentCount: summary.autoAbsent,
        pendingApprovals: summary.pendingLeave
      }
    });

  } catch (error) {
    console.error("Get today summary error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get today's attendance summary"
    });
  }
});

// 🔹 Admin: Force Run Auto-Absent Check
router.post("/attendance/admin/run-auto-absent", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only."
      });
    }

    await autoMarkAbsentUsers();
    
    res.status(200).json({
      success: true,
      message: "Auto-absent check completed successfully"
    });

  } catch (error) {
    console.error("Force auto-absent error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to run auto-absent check"
    });
  }
});

module.exports = router;