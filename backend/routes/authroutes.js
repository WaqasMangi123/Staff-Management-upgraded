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
const NODE_ENV = process.env.NODE_ENV || "development";

console.log("Email Configuration:");
console.log("EMAIL_USER:", EMAIL_USER ? "Set" : "Not set");
console.log("ADMIN_EMAIL:", ADMIN_EMAIL);
console.log("EMAIL_FROM:", EMAIL_FROM);
console.log("Environment:", NODE_ENV);

// AUTHENTICATION MIDDLEWARE
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

// BREVO SMTP Setup - Render Production Ready
let smtpTransporter = null;

try {
  console.log('Setting up SMTP transporter for', NODE_ENV, 'environment...');
  
  // Use port 2525 for production (Render-compatible), 587 for development
  const smtpPort = NODE_ENV === 'production' ? 2525 : 587;
  console.log('Using SMTP port:', smtpPort);
  
  smtpTransporter = nodemailer.createTransporter({
    host: 'smtp-relay.brevo.com',
    port: smtpPort,
    secure: false, // false for both 587 and 2525
    auth: {
      user: '999adf001@smtp-brevo.com',
      pass: 'Ck78h6BWgbMc32Kj'
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: NODE_ENV === 'production' ? 60000 : 30000, // Longer timeout for production
    greetingTimeout: NODE_ENV === 'production' ? 30000 : 15000,
    socketTimeout: NODE_ENV === 'production' ? 60000 : 30000,
    pool: NODE_ENV === 'production', // Use connection pooling in production
    maxConnections: NODE_ENV === 'production' ? 5 : 1,
    maxMessages: NODE_ENV === 'production' ? 10 : 1
  });

  console.log('SMTP transporter created successfully');
  
  // Test connection (non-blocking for production)
  if (NODE_ENV === 'development') {
    smtpTransporter.verify((error, success) => {
      if (error) {
        console.log('SMTP connection test failed:', error.message);
      } else {
        console.log('SMTP server is ready');
      }
    });
  } else {
    // In production, test in background
    setTimeout(() => {
      smtpTransporter.verify((error, success) => {
        if (error) {
          console.log('Production SMTP connection test failed:', error.message);
        } else {
          console.log('Production SMTP server is ready');
        }
      });
    }, 5000);
  }
  
} catch (error) {
  console.error('Failed to create SMTP transporter:', error.message);
}

// Email sending function with production optimizations
const sendEmail = async (emailData) => {
  if (!smtpTransporter) {
    throw new Error('SMTP transporter not initialized');
  }

  try {
    const result = await smtpTransporter.sendMail({
      from: `"Staff Management" <${EMAIL_USER}>`,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      priority: 'normal',
      headers: {
        'X-Mailer': 'Staff Management System',
        'X-Environment': NODE_ENV
      }
    });
    
    console.log(`Email sent successfully in ${NODE_ENV}:`, result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error(`Email sending failed in ${NODE_ENV}:`, error.message);
    throw error;
  }
};

// Helper Functions
const generateVerificationCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendVerificationEmail = async (email, verificationCode) => {
  try {
    await sendEmail({
      to: email,
      subject: "Verify Your Email Address - Staff Management",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0; font-size: 28px;">Email Verification</h1>
              <p style="color: #666; margin: 10px 0;">Staff Management System</p>
            </div>
            
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); color: white; padding: 25px; border-radius: 12px; font-size: 36px; font-weight: bold; letter-spacing: 5px; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);">
                ${verificationCode}
              </div>
            </div>
            
            <div style="text-align: center; margin-bottom: 25px;">
              <p style="font-size: 18px; color: #495057; margin: 0; font-weight: 500;">Enter this 6-digit code to verify your email</p>
              <p style="font-size: 14px; color: #6c757d; margin: 10px 0;">This code is valid for 10 minutes only</p>
            </div>
            
            <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin-bottom: 20px;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>Security Notice:</strong> If you didn't request this verification, please ignore this email.
              </p>
            </div>
            
            <div style="text-align: center; color: #6c757d; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
              <p>Staff Management System | Secure Email Verification</p>
            </div>
          </div>
        </div>
      `
    });
    
    console.log('Verification email sent to:', email);
    return true;
  } catch (err) {
    console.error("Failed to send verification email:", err.message);
    throw new Error("Failed to send verification email");
  }
};

const sendLeaveApplicationEmail = async (userDetails, leaveDetails) => {
  return new Promise((resolve) => {
    setTimeout(async () => {
      try {
        const leaveDate = new Date(leaveDetails.date).toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const daysUntil = Math.ceil((new Date(leaveDetails.date) - new Date()) / (1000 * 60 * 60 * 24));
        const urgencyColor = daysUntil <= 2 ? '#dc3545' : daysUntil <= 7 ? '#ffc107' : '#28a745';
        const urgencyText = daysUntil <= 2 ? 'URGENT' : daysUntil <= 7 ? 'SOON' : 'ADVANCE';

        await sendEmail({
          to: ADMIN_EMAIL,
          subject: `Leave Application - ${userDetails.name || userDetails.username} (${urgencyText})`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
              <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <div style="text-align: center; margin-bottom: 30px;">
                  <h1 style="color: #2563eb; margin: 0; font-size: 28px;">New Leave Application</h1>
                  <div style="background-color: ${urgencyColor}; color: white; padding: 8px 15px; border-radius: 20px; display: inline-block; margin-top: 10px; font-weight: bold; font-size: 12px;">
                    ${urgencyText} - ${daysUntil} day(s) until leave
                  </div>
                </div>
                <div style="background-color: #e7f3ff; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #2563eb;">
                  <h3 style="color: #2563eb; margin: 0 0 15px 0;">Employee Information</h3>
                  <p><strong>Name:</strong> ${userDetails.name || userDetails.username}</p>
                  <p><strong>Email:</strong> ${userDetails.email}</p>
                  <p><strong>Department:</strong> ${userDetails.department || 'Not Set'}</p>
                  <p><strong>Position:</strong> ${userDetails.jobTitle || 'Not Set'}</p>
                </div>
                <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                  <h3 style="color: #856404; margin: 0 0 15px 0;">Leave Details</h3>
                  <p><strong>Date:</strong> ${leaveDate}</p>
                  <p><strong>Type:</strong> ${leaveDetails.leaveType}</p>
                  <p><strong>Reason:</strong> ${leaveDetails.reason}</p>
                  <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
                </div>
                <div style="text-align: center;">
                  <a href="${FRONTEND_URL}/admin-attendance" style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    View in Admin Dashboard
                  </a>
                </div>
              </div>
            </div>
          `
        });

        console.log(`Leave application email sent for ${userDetails.username}`);
        resolve();
      } catch (err) {
        console.error("Failed to send leave application email:", err.message);
        resolve(); // Don't block leave application
      }
    }, NODE_ENV === 'production' ? 500 : 100);
  });
};

const sendLeaveStatusEmail = async (userEmail, userName, leaveDetails, isApproved, adminNotes) => {
  return new Promise((resolve) => {
    setTimeout(async () => {
      try {
        const leaveDate = new Date(leaveDetails.date).toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const statusColor = isApproved ? '#28a745' : '#dc3545';
        const statusText = isApproved ? 'APPROVED' : 'REJECTED';
        const statusIcon = isApproved ? '✅' : '❌';

        await sendEmail({
          to: userEmail,
          subject: `${statusIcon} Leave Request ${statusText} - ${leaveDate}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
              <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <div style="text-align: center; margin-bottom: 30px;">
                  <h1 style="color: ${statusColor}; margin: 0; font-size: 28px;">${statusIcon} Leave Request ${statusText}</h1>
                </div>
                <div style="background-color: ${statusColor}; color: white; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 25px;">
                  <h2 style="margin: 0; font-size: 24px;">Your leave request has been ${statusText.toLowerCase()}</h2>
                </div>
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                  <h3 style="color: #495057; margin: 0 0 15px 0;">Leave Details</h3>
                  <p><strong>Date:</strong> ${leaveDate}</p>
                  <p><strong>Type:</strong> ${leaveDetails.leaveType}</p>
                  <p><strong>Your Reason:</strong> ${leaveDetails.reason}</p>
                  <p><strong>Decision Date:</strong> ${new Date().toLocaleDateString()}</p>
                </div>
                ${adminNotes ? `
                <div style="background-color: #e9ecef; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                  <h3 style="color: #495057; margin: 0 0 15px 0;">Admin Notes</h3>
                  <p style="margin: 0; font-style: italic;">"${adminNotes}"</p>
                </div>
                ` : ''}
              </div>
            </div>
          `
        });

        console.log(`Leave status email sent to ${userEmail}`);
        resolve();
      } catch (err) {
        console.error("Failed to send leave status email:", err.message);
        resolve();
      }
    }, NODE_ENV === 'production' ? 500 : 100);
  });
};

// Test endpoint with environment info
router.post("/test-email", async (req, res) => {
  try {
    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `Test Email - Staff Management System (${NODE_ENV})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #28a745;">Email Test Successful!</h2>
          <p>This test confirms your email system is working in <strong>${NODE_ENV}</strong> environment.</p>
          <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>From:</strong> ${EMAIL_USER}</p>
          <p><strong>To:</strong> ${ADMIN_EMAIL}</p>
          <p><strong>Server:</strong> smtp-relay.brevo.com</p>
          <p><strong>Port:</strong> ${NODE_ENV === 'production' ? '2525' : '587'}</p>
          <p><strong>Environment:</strong> ${NODE_ENV}</p>
        </div>
      `
    });
    
    res.json({ 
      success: true, 
      message: `Test email sent successfully in ${NODE_ENV} environment`,
      environment: NODE_ENV,
      port: NODE_ENV === 'production' ? 2525 : 587,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Test email failed:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      environment: NODE_ENV
    });
  }
});

// Working hours helpers
const getUserWorkingHours = async (userId) => {
  try {
    const profile = await UserProfile.findOne({ userId });
    if (profile && profile.workingHours && profile.workingHours.start) {
      return { start: profile.workingHours.start, end: profile.workingHours.end };
    }
    return { start: '09:00', end: '17:00' };
  } catch (error) {
    console.error('Error getting user working hours:', error);
    return { start: '09:00', end: '17:00' };
  }
};

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

const shouldMarkAsAbsent = async (userId) => {
  try {
    const workingHours = await getUserWorkingHours(userId);
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const [startHour, startMinute] = workingHours.start.split(':').map(Number);
    const workStartMinutes = startHour * 60 + startMinute;
    const absentThresholdMinutes = workStartMinutes + 120;
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const currentMinutes = currentHour * 60 + currentMinute;
    
    return currentMinutes > absentThresholdMinutes;
  } catch (error) {
    console.error('Error checking absent condition:', error);
    return false;
  }
};

const autoMarkAbsentUsers = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const allUsers = await User.find({ role: 'user', verified: true }).select('_id username email');
    
    for (const user of allUsers) {
      const existingAttendance = await Attendance.findOne({ userId: user._id, date: today });
      
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

// Middleware
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

// Validation
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

// USER REGISTRATION
router.post("/register", validateRegisterInput, async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

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
    
    try {
      await sendVerificationEmail(newUser.email, verificationCode);
      
      res.status(201).json({ 
        success: true,
        message: "Account created successfully! Please check your email for verification code.",
        userId: newUser._id,
        emailSent: true
      });
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError.message);
      
      res.status(201).json({ 
        success: true,
        message: "Account created successfully! Email service is temporarily unavailable. Your verification code is: " + verificationCode,
        userId: newUser._id,
        emailSent: false,
        verificationCode: NODE_ENV === 'development' ? verificationCode : undefined
      });
    }

  } catch (err) {
    console.error("Registration Error:", err);
    res.status(500).json({ 
      success: false,
      message: "Server error during registration. Please try again.",
      error: NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// EMAIL VERIFICATION
router.post("/verify", async (req, res) => {
  try {
    const { email, verificationCode } = req.body;
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCode = verificationCode ? verificationCode.toString().trim() : '';

    if (NODE_ENV === 'development') {
      console.log('Verification attempt:', {
        email: trimmedEmail,
        receivedCode: verificationCode,
        trimmedCode: trimmedCode,
        codeLength: trimmedCode.length,
        codeType: typeof verificationCode
      });
    }

    if (!trimmedEmail || !trimmedCode) {
      return res.status(400).json({ 
        success: false,
        message: "Email and verification code are required" 
      });
    }

    if (!/^\d{6}$/.test(trimmedCode)) {
      return res.status(400).json({ 
        success: false,
        message: `Verification code must be exactly 6 digits. Received: "${trimmedCode}" (length: ${trimmedCode.length})`
      });
    }

    const user = await User.findOne({
      email: trimmedEmail,
      verificationCode: trimmedCode,
      verificationCodeExpires: { $gt: Date.now() }
    });

    if (!user) {
      if (NODE_ENV === 'development') {
        const userExists = await User.findOne({ email: trimmedEmail });
        if (userExists) {
          console.log('User exists but code mismatch:', {
            storedCode: userExists.verificationCode,
            receivedCode: trimmedCode,
            codeExpires: userExists.verificationCodeExpires,
            isExpired: userExists.verificationCodeExpires < Date.now()
          });
        }
      }
      
      return res.status(400).json({ 
        success: false,
        message: "Invalid or expired verification code" 
      });
    }

    user.verified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "24h" });

    res.status(200).json({ 
      success: true,
      message: "Email verified successfully! You are now logged in.",
      token,
      user: { id: user._id, email: user.email, username: user.username, role: user.role }
    });

  } catch (err) {
    console.error("Verification Error:", err);
    res.status(500).json({ 
      success: false,
      message: "Server error during verification. Please try again."
    });
  }
});

// USER LOGIN
router.post("/login", validateLoginInput, async (req, res) => {
  try {
    const { email, password } = req.body;
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    const user = await User.findOne({ email: trimmedEmail }).select('+password');
    
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
        message: "Please verify your email before logging in."
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

    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "24h" });

    res.status(200).json({
      success: true,
      message: "Welcome back! Login successful.",
      token,
      user: { id: user._id, username: user.username, email: user.email, role: user.role }
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ 
      success: false,
      message: "Server error during login. Please try again."
    });
  }
});

// RESEND VERIFICATION
router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
      return res.status(404).json({ success: false, message: "No account found with this email address" });
    }

    if (user.verified) {
      return res.status(400).json({ success: false, message: "This account is already verified" });
    }

    const verificationCode = generateVerificationCode();
    user.verificationCode = verificationCode;
    user.verificationCodeExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    await sendVerificationEmail(user.email, verificationCode);

    res.status(200).json({ success: true, message: "Verification email sent! Please check your inbox." });

  } catch (err) {
    console.error("Resend Verification Error:", err);
    res.status(500).json({ success: false, message: "Failed to send verification email. Please try again." });
  }
});

// FORGOT PASSWORD
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
      return res.status(200).json({ success: true, message: "If an account exists, a reset link has been sent" });
    }

    const resetToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1h" });
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const resetUrl = `${FRONTEND_URL}/#/reset-password/${resetToken}`;
    
    await sendEmail({
      to: user.email,
      subject: "Password Reset Request",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">Password Reset</h2>
          <p>Click below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p style="color: #dc3545;">This link expires in 1 hour.</p>
          <p style="color: #666; font-size: 12px;">If you can't click the button, copy this link: ${resetUrl}</p>
        </div>
      `
    });

    res.status(200).json({ success: true, message: "Password reset link sent to your email" });

  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ success: false, message: "Server error processing your request" });
  }
});

// VALIDATE RESET TOKEN
router.post("/validate-reset-token", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ valid: false, message: "Token is required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({
      _id: decoded.id,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(200).json({ valid: false, message: "Invalid or expired token" });
    }

    res.status(200).json({ valid: true, message: "Token is valid", email: user.email });

  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(200).json({ valid: false, message: "Token has expired" });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(200).json({ valid: false, message: "Invalid token" });
    }
    res.status(500).json({ valid: false, message: "Server error during token validation" });
  }
});

// RESET PASSWORD
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: "Token and new password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({
      _id: decoded.id,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    }).select('+password');

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
    }

    const isSamePassword = await user.comparePassword(newPassword.trim());
    if (isSamePassword) {
      return res.status(400).json({ success: false, message: "New password must be different from current password" });
    }

    user.password = newPassword.trim();
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    await sendEmail({
      to: user.email,
      subject: "Password Changed Successfully",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #28a745;">Password Updated</h2>
          <p>Your password was successfully changed.</p>
          <p>If you didn't make this change, please contact support immediately.</p>
        </div>
      `
    });

    res.status(200).json({ success: true, message: "Password updated successfully!" });

  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ success: false, message: "Server error processing your request" });
  }
});

// GET ALL USERS
router.get("/users", async (req, res) => {
  try {
    const users = await User.find({}, 'username email role createdAt lastActive verified').sort({ createdAt: -1 });

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
    res.status(500).json({ success: false, message: "Server error fetching users" });
  }
});

// GET ACTIVE USERS
router.get("/active-users", async (req, res) => {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    
    const activeUsers = await User.find(
      { lastActive: { $gte: fifteenMinutesAgo } },
      'username email role lastActive'
    ).sort({ lastActive: -1 });

    res.status(200).json({ success: true, activeUsers, count: activeUsers.length });
  } catch (err) {
    console.error("Error fetching active users:", err);
    res.status(500).json({ success: false, message: "Server error fetching active users" });
  }
});

// DELETE USER
router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
      deletedUser: { id: user._id, username: user.username, email: user.email }
    });

  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ success: false, message: "Server error while deleting user" });
  }
});

// GET USER PROFILE
router.get("/profile/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const profile = await UserProfile.findOne({ userId });
    
    res.status(200).json({ success: true, profile: profile || null });

  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch profile" });
  }
});

// UPDATE/CREATE USER PROFILE
router.post("/update-profile", async (req, res) => {
  try {
    const { userId, name, phone, profilePicture, department, jobTitle, shift, workingHours, skills, yearsWorked, specialTraining, shiftFlexibility, emergencyContact, notes } = req.body;

    if (!userId || !name || !phone || !department || !jobTitle || !shift) {
      return res.status(400).json({ success: false, message: "Required fields: name, phone, department, jobTitle, shift" });
    }

    if (!workingHours || !workingHours.start || !workingHours.end) {
      return res.status(400).json({ success: false, message: "Working hours start and end times are required" });
    }

    if (!emergencyContact || !emergencyContact.name || !emergencyContact.relationship || !emergencyContact.phone) {
      return res.status(400).json({ success: false, message: "Emergency contact information is required" });
    }

    let profile = await UserProfile.findOne({ userId });

    if (profile) {
      Object.assign(profile, {
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
        profileComplete: true,
        lastUpdated: new Date()
      });
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
    }

    await profile.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      profile: { id: profile._id, userId: profile.userId, name: profile.name, department: profile.department, jobTitle: profile.jobTitle, profileComplete: profile.profileComplete }
    });

  } catch (error) {
    console.error("Update profile error:", error);
    
    if (error.name === 'ValidationError') {
      const errorMessages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ success: false, message: errorMessages.join(', ') });
    }
    
    res.status(500).json({ success: false, message: "Failed to update profile" });
  }
});

// GET USER PROFILE (with auth)
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('-password');
    const profile = await UserProfile.findOne({ userId });
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        verified: user.verified,
        createdAt: user.createdAt,
        lastActive: user.lastActive
      },
      profile: profile || null
    });

  } catch (error) {
    console.error("Get authenticated user profile error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch user profile" });
  }
});

// ATTENDANCE ROUTES

// SMART CHECK-IN
router.post("/attendance/check-in", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const existingAttendance = await Attendance.findOne({ userId, date: today });
    if (existingAttendance) {
      if (existingAttendance.status === 'leave') {
        return res.status(400).json({ success: false, message: "Cannot check in - you have approved leave for today" });
      }
      
      if (existingAttendance.checkIn && existingAttendance.checkIn.time) {
        return res.status(400).json({ success: false, message: "Already checked in today", checkInTime: existingAttendance.checkIn.time });
      }
    }

    const checkInTime = new Date();
    const { location, notes } = req.body;
    const workingHours = await getUserWorkingHours(userId);
    
    const [workStartHour, workStartMinute] = workingHours.start.split(':').map(Number);
    const workStartMinutes = workStartHour * 60 + workStartMinute;
    const checkInTotalMinutes = checkInTime.getHours() * 60 + checkInTime.getMinutes();
    
    const delayMinutes = checkInTotalMinutes - workStartMinutes;
    const delayHours = Math.floor(delayMinutes / 60);
    const delayMins = delayMinutes % 60;
    
    let status = 'present';
    let message = `Checked in successfully at ${checkInTime.toLocaleTimeString()}`;
    
    if (delayMinutes > 120) {
      const attendance = existingAttendance || new Attendance({
        userId, username: user.username, email: user.email, date: today
      });
      
      attendance.status = 'absent';
      attendance.absentReason = `Excessive delay - ${delayHours}h ${delayMins}m late`;
      attendance.notes = `Attempted check-in at ${checkInTime.toLocaleTimeString()} - marked absent due to excessive delay`;
      attendance.isManualEntry = true;
      
      await attendance.save();
      
      return res.status(400).json({
        success: false,
        message: `Cannot check in - marked as absent due to excessive delay (${delayHours}h ${delayMins}m late). Contact admin for manual correction.`,
        attendance: { id: attendance._id, status: 'absent', reason: attendance.absentReason }
      });
      
    } else if (delayMinutes > 10) {
      status = 'late';
      message = `Checked in late at ${checkInTime.toLocaleTimeString()} (${delayHours > 0 ? `${delayHours}h ` : ''}${delayMins}m late)`;
    }

    const attendance = existingAttendance || new Attendance({
      userId, username: user.username, email: user.email, date: today
    });
    
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

    await attendance.save();

    res.status(200).json({
      success: true,
      message: message,
      attendance: {
        id: attendance._id,
        checkInTime: attendance.checkIn.time,
        status: attendance.status,
        isLate: attendance.status === 'late',
        workingHours: workingHours
      }
    });

  } catch (error) {
    console.error("Check-in error:", error);
    res.status(500).json({ success: false, message: "Failed to check in" });
  }
});

// CHECK-OUT
router.post("/attendance/check-out", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    
    const attendance = await Attendance.findOne({ userId, date: today });
    if (!attendance || !attendance.checkIn || !attendance.checkIn.time) {
      return res.status(400).json({ success: false, message: "No check-in record found for today" });
    }

    if (attendance.checkOut && attendance.checkOut.time) {
      return res.status(400).json({ success: false, message: "Already checked out today", checkOutTime: attendance.checkOut.time });
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
    res.status(500).json({ success: false, message: "Failed to check out" });
  }
});

// APPLY FOR LEAVE
router.post("/attendance/apply-leave", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { reason, date, leaveType } = req.body;
    
    if (!reason || !date || !leaveType) {
      return res.status(400).json({ success: false, message: "Reason, date, and leave type are required" });
    }
    
    const today = new Date().toISOString().split('T')[0];
    const leaveDate = new Date(date).toISOString().split('T')[0];
    
    if (leaveDate <= today) {
      return res.status(400).json({ success: false, message: "Leave can only be applied for future dates. For today or past dates, contact your admin directly." });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const existingAttendance = await Attendance.findOne({ userId, date: leaveDate });
    if (existingAttendance) {
      return res.status(400).json({ success: false, message: "Attendance already marked for this date" });
    }

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

    const userProfile = await UserProfile.findOne({ userId });
    const userDetails = {
      username: user.username,
      email: user.email,
      name: userProfile?.name || user.username,
      department: userProfile?.department || 'Not Set',
      jobTitle: userProfile?.jobTitle || 'Not Set'
    };

    const leaveDetails = { date: leaveDate, leaveType: leaveType, reason: reason };

    res.status(200).json({
      success: true,
      message: "Leave application submitted successfully. Admin notification is being sent.",
      attendance: {
        id: attendance._id,
        date: attendance.date,
        status: attendance.status,
        leaveType: leaveType,
        reason: reason,
        approvalStatus: 'pending'
      }
    });

    // Send email in background
    setImmediate(async () => {
      try {
        await sendLeaveApplicationEmail(userDetails, leaveDetails);
        console.log(`Leave application email sent for ${user.username}`);
      } catch (emailError) {
        console.error("Background email failed:", emailError);
      }
    });

  } catch (error) {
    console.error("Apply leave error:", error);
    res.status(500).json({ success: false, message: "Failed to apply for leave: " + error.message });
  }
});

// GET TODAY'S ATTENDANCE
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
        console.log(`Real-time auto-marked ${user.username} as absent`);
      }
    }
    
    if (!attendance) {
      return res.status(200).json({
        success: true,
        attendance: null,
        status: 'not-checked-in',
        workingHours: workingHours,
        shouldAutoMarkAbsent: shouldMarkAbsent
      });
    }

    let status = 'not-checked-in';
    
    if (attendance.status === 'absent') {
      status = 'absent';
    } else if (attendance.status === 'leave') {
      status = 'leave';
    } else if (attendance.checkIn && attendance.checkIn.time) {
      status = attendance.checkOut && attendance.checkOut.time ? 'checked-out' : 'checked-in';
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
    res.status(500).json({ success: false, message: "Failed to get attendance status" });
  }
});

// GET ATTENDANCE HISTORY
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

    const attendance = await Attendance.find(query).sort({ date: -1 }).limit(limit * 1).skip((page - 1) * limit);
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
    res.status(500).json({ success: false, message: "Failed to get attendance history" });
  }
});

// ADMIN ATTENDANCE ROUTES - NO AUTHENTICATION REQUIRED

// ADMIN: APPROVE/REJECT LEAVE (NO AUTH)
router.post("/attendance/admin/approve-leave", async (req, res) => {
  try {
    // REMOVED: Authentication check
    // const authHeader = req.headers['authorization'];
    // const token = authHeader && authHeader.split(' ')[1];
    // if (!token) {
    //   return res.status(401).json({ success: false, message: "Access token required" });
    // }
    // const decoded = jwt.verify(token, JWT_SECRET);

    const { attendanceId, isApproved, approvalNotes } = req.body;

    if (typeof isApproved !== 'boolean') {
      return res.status(400).json({ success: false, message: "isApproved must be true or false" });
    }

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({ success: false, message: "Attendance record not found" });
    }

    if (attendance.status !== 'leave') {
      return res.status(400).json({ success: false, message: "This is not a leave request" });
    }

    if (attendance.isApproved !== null) {
      return res.status(400).json({ success: false, message: `Leave request already ${attendance.isApproved ? 'approved' : 'rejected'}` });
    }

    // MODIFIED: Use default admin since no authentication
    const adminUser = { username: 'Admin' };
    const leaveUser = await User.findById(attendance.userId);
    
    attendance.isApproved = isApproved;
    attendance.approvedBy = null; // No specific admin ID since no auth
    attendance.approvalDate = new Date();
    attendance.approvalNotes = approvalNotes || '';
    
    const approvalInfo = `\n--- ADMIN ACTION ---\n${isApproved ? 'APPROVED' : 'REJECTED'} by ${adminUser?.username || 'Admin'} on ${new Date().toLocaleString()}\nNotes: ${approvalNotes || 'None'}`;
    attendance.notes = (attendance.notes || '') + approvalInfo;

    if (!isApproved) {
      await Attendance.findByIdAndDelete(attendanceId);
      
      if (leaveUser && leaveUser.email) {
        setImmediate(async () => {
          try {
            await sendLeaveStatusEmail(leaveUser.email, leaveUser.username, {
              date: attendance.date,
              leaveType: attendance.leaveType,
              reason: attendance.leaveReason
            }, false, approvalNotes);
            console.log(`Leave rejection email sent to ${leaveUser.username}`);
          } catch (emailError) {
            console.error("Failed to send rejection email:", emailError);
          }
        });
      }
      
      res.status(200).json({
        success: true,
        message: "Leave request rejected and removed from records",
        action: 'rejected'
      });
    } else {
      await attendance.save();
      
      if (leaveUser && leaveUser.email) {
        setImmediate(async () => {
          try {
            await sendLeaveStatusEmail(leaveUser.email, leaveUser.username, {
              date: attendance.date,
              leaveType: attendance.leaveType,
              reason: attendance.leaveReason
            }, true, approvalNotes);
            console.log(`Leave approval email sent to ${leaveUser.username}`);
          } catch (emailError) {
            console.error("Failed to send approval email:", emailError);
          }
        });
      }
      
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
    res.status(500).json({ success: false, message: "Failed to process leave approval" });
  }
});

// GET PENDING LEAVES (NO AUTH)
router.get("/attendance/admin/pending-leaves", async (req, res) => {
  try {
    // REMOVED: Authentication check
    // const authHeader = req.headers['authorization'];
    // const token = authHeader && authHeader.split(' ')[1];
    // if (!token) {
    //   return res.status(401).json({ success: false, message: "Access token required" });
    // }
    // jwt.verify(token, JWT_SECRET);

    const pendingLeaves = await Attendance.find({ status: 'leave', isApproved: null }).sort({ createdAt: -1 });

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
    res.status(500).json({ success: false, message: "Failed to get pending leave requests" });
  }
});

// ADMIN: TODAY'S SUMMARY (NO AUTH)
router.get("/attendance/admin/today-summary", async (req, res) => {
  try {
    // REMOVED: Authentication and role check
    // if (req.user.role !== 'admin') {
    //   return res.status(403).json({ success: false, message: "Admin access required" });
    // }

    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = await Attendance.find({ date: today }).populate('userId', 'username email').sort({ 'checkIn.time': 1 });
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
    res.status(500).json({ success: false, message: "Failed to get today's attendance summary" });
  }
});

// Debug routes for testing (production-aware)
router.get("/debug-config", (req, res) => {
  res.json({
    EMAIL_USER: process.env.EMAIL_USER || 'NOT SET',
    NODE_ENV: NODE_ENV,
    hasTransporter: !!smtpTransporter,
    smtpPort: NODE_ENV === 'production' ? 2525 : 587,
    environment: NODE_ENV
  });
});

// Manual SMTP test route (production-aware)
router.get("/test-smtp-manual", async (req, res) => {
  try {
    if (!smtpTransporter) {
      return res.json({ error: "Transporter not initialized" });
    }
    
    const result = await smtpTransporter.sendMail({
      from: EMAIL_USER,
      to: ADMIN_EMAIL,
      subject: `Manual SMTP Test (${NODE_ENV})`,
      text: `This is a manual SMTP test from ${NODE_ENV} environment using port ${NODE_ENV === 'production' ? 2525 : 587}`
    });
    
    res.json({ 
      success: true, 
      messageId: result.messageId,
      environment: NODE_ENV,
      port: NODE_ENV === 'production' ? 2525 : 587
    });
  } catch (error) {
    res.json({ 
      error: error.message,
      environment: NODE_ENV,
      port: NODE_ENV === 'production' ? 2525 : 587
    });
  }
});

module.exports = router;