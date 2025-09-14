const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { sendVerificationEmail } = require("../services/emailService");

// Helper function to generate verification code
const generateVerificationCode = () => Math.floor(100000 + Math.random() * 900000).toString();

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Input validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // Check for existing user
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email is already registered"
      });
    }

    // Hash password with salt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create verification code
    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Create new user
    const user = new User({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      verificationCode,
      verificationCodeExpires,
      role: 'patient',
      verified: false
    });

    await user.save();

    // Send verification email
    await sendVerificationEmail(user.email, verificationCode);

    res.status(201).json({
      success: true,
      message: "Registration successful! Please check your email for verification code."
    });

  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed. Please try again later."
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email } = req.body;

    // Input validation
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    console.log(`[Login Attempt] Email: ${email}`);

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      console.log("[Login Process] User not found");
      return res.status(401).json({
        success: false,
        message: "Account not found"
      });
    }

    console.log(`[Login Process] User verified status: ${user.verified}`);

    // Check if user is verified
    if (!user.verified) {
      return res.status(403).json({
        success: false,
        isVerified: false,
        message: "Please verify your email first"
      });
    }

    // Check JWT secret
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured");
      throw new Error("Server configuration error");
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Prepare user data for response
    const userData = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    console.log(`[Login Success] User ${user.email} logged in`);

    res.status(200).json({
      success: true,
      token,
      user: userData,
      message: "Login successful"
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed. Please try again later."
    });
  }
};

// Email verification handler
exports.verifyEmail = async (req, res) => {
  try {
    const { email, verificationCode } = req.body;

    // Input validation
    if (!email || !verificationCode) {
      return res.status(400).json({
        success: false,
        message: "Email and verification code are required"
      });
    }

    const user = await User.findOne({ 
      email: email.toLowerCase().trim(),
      verificationCode,
      verificationCodeExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification code"
      });
    }

    // Mark user as verified
    user.verified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Email successfully verified!"
    });

  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({
      success: false,
      message: "Email verification failed. Please try again."
    });
  }
};