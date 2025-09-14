import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import axios from 'axios';
import './AdminLogin.css';

// Icons (you can replace with react-icons or any icon library)
const EyeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="m1 1 22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6.71277 6.7226C3.66479 8.79527 2 12 2 12s3 8 10 8c2.0503 0 3.8174-.7266 5.2711-1.7226m-2.1361-2.1359C14.2266 16.6358 13.1632 17 12 17c-3.3137 0-6-2.6863-6-6 0-1.1632.3642-2.2266.8641-3.1359z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="m14 14.2362C13.4692 14.7112 12.7684 15.0001 12 15.0001c-1.6569 0-3-1.3431-3-3 0-.7684.2889-1.4692.7639-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="12" cy="16" r="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const AdminLogin = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:5000/api/admin/login', formData);
      
      if (response.data.success) {
        // Store admin token and data
        localStorage.setItem('adminToken', response.data.token);
        localStorage.setItem('adminData', JSON.stringify(response.data.admin));
        
        toast.success('Admin login successful!');
        navigate('/admin/dashboard');
      }
    } catch (error) {
      if (error.response && error.response.data) {
        toast.error(error.response.data.message || 'Admin login failed');
      } else {
        toast.error('Network error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.6,
        ease: "easeOut",
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  const floatingVariants = {
    animate: {
      y: [-10, 10, -10],
      transition: {
        duration: 6,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <div className="admin-login-container">
      {/* Background Elements */}
      <div className="background-elements">
        <motion.div 
          className="floating-shape shape-1"
          variants={floatingVariants}
          animate="animate"
        />
        <motion.div 
          className="floating-shape shape-2"
          variants={floatingVariants}
          animate="animate"
          style={{ animationDelay: '2s' }}
        />
        <motion.div 
          className="floating-shape shape-3"
          variants={floatingVariants}
          animate="animate"
          style={{ animationDelay: '4s' }}
        />
      </div>

      <motion.div 
        className="login-card"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div className="login-header" variants={itemVariants}>
          <div className="logo-container">
            <div className="logo">
              <UserIcon />
            </div>
          </div>
          <h1>Admin Portal</h1>
          <p>Staff Management System</p>
        </motion.div>

        {/* Form */}
        <motion.form 
          className="login-form" 
          onSubmit={handleSubmit}
          variants={itemVariants}
        >
          {/* Email Field */}
          <div className="form-group">
            <label>Email Address</label>
            <div className={`input-container ${focusedField === 'email' ? 'focused' : ''}`}>
              <UserIcon />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                placeholder="Enter your admin email"
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="form-group">
            <label>Password</label>
            <div className={`input-container ${focusedField === 'password' ? 'focused' : ''}`}>
              <LockIcon />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <motion.button
            type="submit"
            className={`submit-btn ${loading ? 'loading' : ''}`}
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
          >
            {loading ? (
              <>
                <div className="loading-spinner"></div>
                Authenticating...
              </>
            ) : (
              'Sign In to Dashboard'
            )}
          </motion.button>
        </motion.form>

        {/* Footer */}
        <motion.div className="login-footer" variants={itemVariants}>
          <p>
            Staff member? 
            <motion.button 
              onClick={() => navigate('/login')}
              className="link-btn"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Login On mobile app
            </motion.button>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default AdminLogin;