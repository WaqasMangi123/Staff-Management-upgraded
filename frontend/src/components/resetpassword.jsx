import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import './resetpassword.css';

const backgroundImages = [
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1471&q=80",
  "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80",
  "https://images.unsplash.com/photo-1521791136064-7986c2920216?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1469&q=80"
];

const ResetPassword = () => {
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isTokenChecked, setIsTokenChecked] = useState(false);
  const [currentBgIndex, setCurrentBgIndex] = useState(0);
  const { token } = useParams();
  const navigate = useNavigate();

  // Background image slider effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBgIndex((prev) => (prev + 1) % backgroundImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const validateToken = async () => {
      try {
        const response = await axios.post(
          'https://parksy-backend.onrender.com/api/auth/validate-reset-token', 
          { token }
        );
        
        if (response.data.valid) {
          setIsValidToken(true);
        } else {
          setErrors({ token: response.data.message || "Invalid or expired token." });
        }
      } catch (err) {
        setErrors({
          token: err.response?.data?.message || "Invalid or expired token."
        });
        console.error("Token validation error:", err);
      } finally {
        setIsTokenChecked(true);
      }
    };

    if (token) {
      validateToken();
    } else {
      setErrors({ token: "No token provided." });
      setIsTokenChecked(true);
    }
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
    if (message) {
      setMessage("");
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.newPassword) {
      newErrors.newPassword = "Password is required";
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters";
    }

    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;

    setIsLoading(true);
    setErrors({});
    setMessage("");

    try {
      const response = await axios.post(
        'https://parksy-backend.onrender.com/api/auth/reset-password',
        { 
          token, 
          newPassword: formData.newPassword 
        }
      );
      
      setMessage(response.data.message || "Password reset successfully!");
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      console.error("Reset password error:", err);
      setErrors({
        server: err.response?.data?.message || 
               "An error occurred. Please try again."
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isTokenChecked) {
    return (
      <div className="reset-container">
        <div className="loading-container">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="loading-spinner"
          />
          <p className="loading-text">Validating reset token...</p>
        </div>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="reset-container">
        <div className="error-card">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h3 className="error-title">Password Reset Failed</h3>
            <p className="error-message">{errors.token}</p>
            <motion.button
              onClick={() => navigate('/forgot-password')}
              className="error-link"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Request new reset link
            </motion.button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-container">
      {/* Background image slider */}
      <div className="background-container">
        {backgroundImages.map((img, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: index === currentBgIndex ? 1 : 0 }}
            transition={{ duration: 1.5 }}
            className="background-image"
            style={{ backgroundImage: `url(${img})` }}
          >
            <div className="background-overlay" />
          </motion.div>
        ))}
      </div>

      {/* Reset password form */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="reset-form-container"
      >
        <div className="reset-form-card">
          {/* Form header */}
          <div className="form-header">
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 10 }}
            >
              <h2 className="form-title">Reset Your Password</h2>
              <p className="form-subtitle">Create a new password for your account</p>
            </motion.div>
          </div>

          <div className="form-content">
            {errors.server && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="error-alert"
              >
                {errors.server}
              </motion.div>
            )}

            {message && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="success-alert"
              >
                {message}
              </motion.div>
            )}

            <form className="form" onSubmit={handleSubmit}>
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="form-fields"
              >
                <div className="form-group">
                  <label htmlFor="newPassword" className="form-label">
                    New Password
                  </label>
                  <div className="input-container">
                    <div className="input-icon">
                      <svg className="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <input
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength="8"
                      className={`form-input ${errors.newPassword ? 'input-error' : ''}`}
                      placeholder="New Password (min 8 characters)"
                      value={formData.newPassword}
                      onChange={handleChange}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.newPassword && (
                    <motion.p 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="error-message"
                    >
                      <svg className="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      {errors.newPassword}
                    </motion.p>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword" className="form-label">
                    Confirm Password
                  </label>
                  <div className="input-container">
                    <div className="input-icon">
                      <svg className="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 616 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength="8"
                      className={`form-input ${errors.confirmPassword ? 'input-error' : ''}`}
                      placeholder="Confirm Password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.confirmPassword && (
                    <motion.p 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="error-message"
                    >
                      <svg className="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      {errors.confirmPassword}
                    </motion.p>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`submit-button ${isLoading ? 'loading' : ''}`}
                >
                  <span className="button-overlay"></span>
                  <span className="button-content">
                    {isLoading ? (
                      <>
                        <svg 
                          className="button-spinner" 
                          xmlns="http://www.w3.org/2000/svg" 
                          fill="none" 
                          viewBox="0 0 24 24"
                        >
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Resetting...
                      </>
                    ) : (
                      <>
                        <svg className="button-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        Reset Password
                      </>
                    )}
                  </span>
                </button>
              </motion.div>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ✅ FIXED: Export with correct name to match import in App.js
export default ResetPassword;