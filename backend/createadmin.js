// createAdmin.js - Run this script to create your first admin
require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/admin'); // Adjust path as needed

const createFirstAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Check if any admin already exists
    const existingAdmin = await Admin.findOne({});
    if (existingAdmin) {
      console.log('Admin already exists. Use the admin panel to create more admins.');
      process.exit(1);
    }

    // Create the first super admin
    const admin = new Admin({
      username: 'Super Admin',
      email: 'admin@staffmanagement.com', // Change this
      password: 'admin123456', // Change this to a strong password
      role: 'super_admin',
      permissions: [
        'staff_management',
        'duty_scheduling', 
        'leave_management',
        'performance_tracking',
        'user_management',
        'system_settings'
      ]
    });

    await admin.save();
    
    console.log('First admin created successfully!');
    console.log('Email:', admin.email);
    console.log('Password: admin123456');
    console.log('Please change the password after first login!');
    console.log('Admin Login: http://localhost:3000/admin/login');
    
  } catch (error) {
    console.error('Error creating admin:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

createFirstAdmin();