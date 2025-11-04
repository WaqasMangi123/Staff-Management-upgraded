require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');

// Validate required environment variables - AUTH ONLY
const requiredEnvVars = [
  'MONGO_URI',
  'JWT_SECRET'
];

const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars);
  console.error('Required: MONGO_URI, JWT_SECRET');
  process.exit(1);
}

// Initialize Express
const app = express();
const server = http.createServer(app);

// Environment check
const isDevelopment = process.env.NODE_ENV !== 'production';

// Basic security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));
app.disable('x-powered-by');
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// CORS configuration - LOCALHOST ONLY
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (Postman, mobile apps)
    if (!origin) return callback(null, true);
    
    // Local development origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8080',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:8080'
    ];
    
    if (allowedOrigins.includes(origin) || isDevelopment) {
      return callback(null, true);
    }
    
    console.warn(`❌ CORS blocked origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 500 : 100,
  message: {
    error: 'Too many requests, please try again later',
    reset_time: new Date(Date.now() + 15 * 60 * 1000).toISOString()
  }
});
app.use(limiter);

// Database connection
const connectDB = async (retries = 3, interval = 3000) => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 8000
    });
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    if (retries > 0) {
      console.log(`🔄 Retrying connection (${retries} attempts left)...`);
      setTimeout(() => connectDB(retries - 1, interval), interval);
    } else {
      console.error('💥 Failed to connect to MongoDB');
      process.exit(1);
    }
  }
};
connectDB();

// Helper function to safely load routes
const safeLoadRoute = (routePath, mountPath, description) => {
  console.log(`📝 Loading ${description}...`);
  try {
    const routes = require(routePath);
    app.use(mountPath, routes);
    console.log(`✅ ${description} loaded successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to load ${description}:`, error.message);
    
    // Fallback router
    app.use(mountPath, (req, res) => {
      res.status(503).json({
        success: false,
        message: `${description} temporarily unavailable`,
        error: 'Routes not loaded'
      });
    });
    return false;
  }
};

// Load existing auth and admin routes
safeLoadRoute('./routes/authroutes', '/api/auth', 'user auth routes');
safeLoadRoute('./routes/adminRoutes', '/api/admin', 'admin routes');

// Load new scheduling system routes
safeLoadRoute('./routes/schedule', '/api/schedule', 'schedule routes');
safeLoadRoute('./routes/task', '/api/tasks', 'task routes');
safeLoadRoute('./routes/shift', '/api/shifts', 'shift routes');
safeLoadRoute('./routes/performance', '/api/performance', 'performance routes');
safeLoadRoute('./routes/alert', '/api/alerts', 'alert routes');

// 🔥 Load verification routes (NEW)
safeLoadRoute('./routes/verification', '/api/verification', 'verification routes');

// Health check
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: dbStates[dbStatus] || 'unknown',
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime()),
    service: 'scheduling-management-system'
  });
});

// API info
app.get('/api', (req, res) => {
  res.json({
    message: 'Scheduling Management System API Server',
    version: '2.0.0',
    service: 'scheduling-and-task-management',
    endpoints: {
      authentication: [
        'POST /api/auth/register - User registration',
        'POST /api/auth/login - User login',
        'POST /api/auth/logout - User logout',
        'GET /api/auth/profile - User profile'
      ],
      admin: [
        'POST /api/admin/login - Admin login',
        'GET /api/admin/profile - Admin profile',
        'POST /api/admin/logout - Admin logout'
      ],
      scheduling: [
        'GET /api/schedule - Get schedules',
        'POST /api/schedule - Create schedule',
        'PUT /api/schedule/:id - Update schedule',
        'DELETE /api/schedule/:id - Delete schedule'
      ],
      tasks: [
        'GET /api/tasks - Get tasks',
        'POST /api/tasks - Create task',
        'PUT /api/tasks/:id - Update task',
        'DELETE /api/tasks/:id - Delete task'
      ],
      shifts: [
        'GET /api/shifts - Get shifts',
        'POST /api/shifts - Create shift',
        'PUT /api/shifts/:id - Update shift',
        'DELETE /api/shifts/:id - Delete shift'
      ],
      performance: [
        'GET /api/performance - Get performance metrics',
        'GET /api/performance/:userId - Get user performance',
        'POST /api/performance - Create performance record'
      ],
      alerts: [
        'GET /api/alerts - Get alerts',
        'POST /api/alerts - Create alert',
        'PUT /api/alerts/:id - Mark alert as read',
        'DELETE /api/alerts/:id - Delete alert'
      ],
      verification: [
        'POST /api/verification/create-team - Create secret team',
        'GET /api/verification/teams - Get all teams',
        'GET /api/verification/my-tasks - Get verification tasks',
        'PUT /api/verification/submit/:id - Submit verification report',
        'GET /api/verification/dashboard - Admin dashboard',
        'GET /api/verification/overdue - Get overdue verifications'
      ]
    },
    development_mode: isDevelopment
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Scheduling Management System API Server',
    status: 'online',
    service: 'scheduling-and-task-management',
    version: '2.0.0',
    endpoints: {
      health: '/api/health',
      docs: '/api',
      auth: '/api/auth',
      admin: '/api/admin',
      schedule: '/api/schedule',
      tasks: '/api/tasks',
      shifts: '/api/shifts',
      performance: '/api/performance',
      alerts: '/api/alerts',
      verification: '/api/verification'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    available: [
      '/api', 
      '/api/health', 
      '/api/auth', 
      '/api/admin',
      '/api/schedule',
      '/api/tasks',
      '/api/shifts',
      '/api/performance',
      '/api/alerts',
      '/api/verification'
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      timestamp: new Date().toISOString()
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      timestamp: new Date().toISOString()
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    return res.status(400).json({
      error: 'Duplicate entry',
      details: 'Resource already exists',
      timestamp: new Date().toISOString()
    });
  }

  // Default error
  const statusCode = err.status || 500;
  const message = isDevelopment ? err.message : 'Internal server error';

  res.status(statusCode).json({
    error: message,
    timestamp: new Date().toISOString(),
    ...(isDevelopment && { stack: err.stack })
  });
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`\n🛑 Shutting down (${signal})...`);
  
  server.close(() => {
    console.log('✅ Server closed');
    mongoose.connection.close(() => {
      console.log('✅ Database connection closed');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n🚀 ============================================');
  console.log(`📊 Scheduling Management System Started`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Connecting...'}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log(`💚 Health: http://localhost:${PORT}/api/health`);
  console.log('🚀 ============================================\n');
  
  console.log('🔐 AUTHENTICATION ENDPOINTS:');
  console.log('   POST /api/auth/register - User registration');
  console.log('   POST /api/auth/login - User login');
  console.log('   POST /api/auth/logout - User logout');
  console.log('   GET /api/auth/profile - User profile\n');
  
  console.log('👑 ADMIN ENDPOINTS:');
  console.log('   POST /api/admin/login - Admin login');
  console.log('   GET /api/admin/profile - Admin profile');
  console.log('   POST /api/admin/logout - Admin logout\n');
  
  console.log('📅 SCHEDULING ENDPOINTS:');
  console.log('   GET /api/schedule - Get schedules');
  console.log('   POST /api/schedule - Create schedule');
  console.log('   PUT /api/schedule/:id - Update schedule');
  console.log('   DELETE /api/schedule/:id - Delete schedule\n');
  
  console.log('✅ TASK ENDPOINTS:');
  console.log('   GET /api/tasks - Get tasks');
  console.log('   POST /api/tasks - Create task');
  console.log('   PUT /api/tasks/:id - Update task');
  console.log('   DELETE /api/tasks/:id - Delete task\n');
  
  console.log('⏰ SHIFT ENDPOINTS:');
  console.log('   GET /api/shifts - Get shifts');
  console.log('   POST /api/shifts - Create shift');
  console.log('   PUT /api/shifts/:id - Update shift');
  console.log('   DELETE /api/shifts/:id - Delete shift\n');
  
  console.log('📊 PERFORMANCE ENDPOINTS:');
  console.log('   GET /api/performance - Get performance metrics');
  console.log('   GET /api/performance/:userId - Get user performance');
  console.log('   POST /api/performance - Create performance record\n');
  
  console.log('🔔 ALERT ENDPOINTS:');
  console.log('   GET /api/alerts - Get alerts');
  console.log('   POST /api/alerts - Create alert');
  console.log('   PUT /api/alerts/:id - Mark alert as read');
  console.log('   DELETE /api/alerts/:id - Delete alert\n');
  
  console.log('🔍 VERIFICATION ENDPOINTS (NEW):');
  console.log('   POST /api/verification/create-team - Create secret team');
  console.log('   GET /api/verification/teams - Get all teams');
  console.log('   GET /api/verification/my-tasks - Get verification tasks');
  console.log('   PUT /api/verification/submit/:id - Submit verification report');
  console.log('   GET /api/verification/dashboard - Admin dashboard');
  console.log('   GET /api/verification/overdue - Get overdue verifications\n');
  
  console.log('💡 READY FOR SCHEDULING SYSTEM + VERIFICATION TESTING! 🎉\n');
});