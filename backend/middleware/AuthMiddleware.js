const jwt = require('jsonwebtoken');
const Admin = require('../models/admin'); // Import Admin model for database validation

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    // Check for Authorization header with Bearer format
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        message: "Authorization token required (Format: Bearer <token>)" 
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token is provided
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: "Token not provided" 
      });
    }

    // Get JWT secret (fallback to ADMIN_JWT_SECRET if JWT_SECRET not available)
    const jwtSecret = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET;
    
    if (!jwtSecret) {
      console.error('JWT_SECRET not configured in environment variables');
      return res.status(500).json({ 
        success: false,
        message: "Server configuration error" 
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, jwtSecret);
    
    // Validate token payload
    if (!decoded.id && !decoded.email) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid token payload" 
      });
    }

    // Optional: Verify admin still exists and is active (database validation)
    if (decoded.id) {
      const admin = await Admin.findById(decoded.id).select('isActive isVerified email role');
      
      if (!admin) {
        return res.status(401).json({ 
          success: false,
          message: "Admin account not found" 
        });
      }

      if (!admin.isActive) {
        return res.status(401).json({ 
          success: false,
          message: "Admin account is deactivated" 
        });
      }

      // Store both decoded token data and fresh admin data
      req.admin = decoded;
      req.user = {
        id: admin._id,
        email: admin.email,
        role: admin.role
      };
    } else {
      // Fallback for tokens without ID (backward compatibility)
      req.admin = decoded;
      req.user = decoded;
    }

    // Add request metadata for security logging
    req.clientInfo = {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent') || 'Unknown'
    };

    next();

  } catch (error) {
    console.error('Auth middleware error:', error.message);
    
    // Handle specific JWT errors with appropriate messages
    let message;
    switch (error.name) {
      case "TokenExpiredError":
        message = "Session expired. Please login again.";
        break;
      case "JsonWebTokenError":
        message = "Invalid authentication token";
        break;
      case "NotBeforeError":
        message = "Token not active yet";
        break;
      case "MongooseError":
      case "MongoError":
        message = "Database error during authentication";
        break;
      default:
        message = "Authentication failed";
    }

    res.status(401).json({ 
      success: false, 
      message 
    });
  }
};