import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { motion, AnimatePresence } from "framer-motion";
import "./login.css";

const backgroundImages = [
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1471&q=80",
  "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80",
  "https://images.unsplash.com/photo-1521791136064-7986c2920216?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1469&q=80"
];

function Login({ setAuth }) {
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [currentBgIndex, setCurrentBgIndex] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBgIndex((prev) => (prev + 1) % backgroundImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (location.state?.message) {
      toast.info(location.state.message, {
        position: "top-center",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
        style: { background: "#3b82f6" }
      });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const validate = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);

    try {
      const loginData = { 
        email: formData.email.trim().toLowerCase(),
        password: formData.password
      };

      const response = await axios.post(
        "https://staff-management-upgraded.onrender.com/api/auth/login",
        loginData,
        {
          headers: { "Content-Type": "application/json" },
          timeout: 15000,
          withCredentials: false
        }
      );

      if (response.data.success) {
        // Store authentication data
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));

        if (setAuth) {
          setAuth({
            isAuthenticated: true,
            user: response.data.user,
            token: response.data.token
          });
        }

        // Show success message
        toast.success(response.data.message || "Login successful! Welcome back!", {
          position: "top-center",
          autoClose: 2000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
          style: { 
            background: "linear-gradient(135deg, #10b981, #059669)",
            color: "white",
            fontWeight: "500"
          }
        });

        // Redirect after a short delay
        setTimeout(() => {
          const redirectTo = location.state?.from?.pathname || "/user-home";
          navigate(redirectTo);
        }, 1500);
      }
    } catch (err) {
      console.error('Login error:', err);
      handleLoginError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginError = (err) => {
    let errorMessage = "Login failed. Please try again.";
    let shouldResendVerification = false;
    
    if (err.response) {
      const { status, data } = err.response;
      
      if (data?.message) {
        errorMessage = data.message;
      }

      // Check if email verification is needed
      if (status === 403 && (data?.isVerified === false || errorMessage.includes("verify"))) {
        shouldResendVerification = true;
      }

      // Handle specific error cases with custom styling
      if (status === 401) {
        if (errorMessage.includes("password")) {
          // Incorrect password - show in red
          toast.error(errorMessage, {
            position: "top-center",
            autoClose: 4000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "colored",
            style: { 
              background: "linear-gradient(135deg, #ef4444, #dc2626)",
              color: "white",
              fontWeight: "500"
            }
          });
        } else {
          // Email not found - show in orange
          toast.error(errorMessage, {
            position: "top-center",
            autoClose: 4000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "colored",
            style: { 
              background: "linear-gradient(135deg, #f97316, #ea580c)",
              color: "white",
              fontWeight: "500"
            }
          });
        }
        return; // Exit early for these cases
      }

      if (status === 400) {
        // Validation errors - show in yellow
        toast.warn(errorMessage, {
          position: "top-center",
          autoClose: 4000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
          style: { 
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            color: "white",
            fontWeight: "500"
          }
        });
        return;
      }

      if (status === 500) {
        errorMessage = "Server error. Please try again later.";
      }
    } else if (err.code === "ECONNABORTED") {
      errorMessage = "Request timed out. Please check your connection.";
    } else if (err.request) {
      errorMessage = "No server response. Please check your network connection.";
    } else if (err.message.includes("Network Error")) {
      errorMessage = "Network error. Please check your internet connection.";
    }

    // Handle email verification case with resend option
    if (shouldResendVerification) {
      const toastId = toast.error(
        <div className="verification-toast-content">
          <p className="error-message">{errorMessage}</p>
          <motion.button 
            onClick={() => {
              toast.dismiss(toastId);
              handleResendVerification();
            }}
            className="resend-verification-button"
            disabled={isResending}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              marginTop: "10px",
              padding: "8px 16px",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500"
            }}
          >
            {isResending ? (
              <>
                <svg className="spinner-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style={{width: "16px", height: "16px", marginRight: "8px"}}>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending...
              </>
            ) : "Resend verification email"}
          </motion.button>
        </div>,
        { 
          position: "top-center",
          autoClose: false,
          closeOnClick: false,
          style: { 
            background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
            color: "white",
            fontWeight: "500"
          }
        }
      );
    } else {
      // Default error toast
      toast.error(errorMessage, {
        position: "top-center",
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
        style: { 
          background: "linear-gradient(135deg, #ef4444, #dc2626)",
          color: "white",
          fontWeight: "500"
        }
      });
    }
  };

  const handleResendVerification = async () => {
    setIsResending(true);
    try {
      const email = formData.email.trim().toLowerCase();
      if (!email) {
        toast.error("Please enter your email first", {
          position: "top-center",
          style: { 
            background: "linear-gradient(135deg, #f97316, #ea580c)",
            color: "white",
            fontWeight: "500"
          }
        });
        return;
      }

      const response = await axios.post(
        "https://staff-management-upgraded.onrender.com/api/auth/resend-verification",
        { email },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 15000,
          withCredentials: false
        }
      );

      if (response.data.success) {
        toast.success(response.data.message || "Verification email sent! Check your inbox.", {
          position: "top-center",
          style: { 
            background: "linear-gradient(135deg, #10b981, #059669)",
            color: "white",
            fontWeight: "500"
          }
        });
      } else {
        throw new Error(response.data.message || "Failed to resend verification");
      }
    } catch (err) {
      console.error("Resend error:", err);
      const errorMessage = err.response?.data?.message || "Failed to resend verification email";
      toast.error(errorMessage, {
        position: "top-center",
        style: { 
          background: "linear-gradient(135deg, #ef4444, #dc2626)",
          color: "white",
          fontWeight: "500"
        }
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="login-container">
      {/* Background image slider */}
      <div className="background-container">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentBgIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            className="background-image"
            style={{
              backgroundImage: `url(${backgroundImages[currentBgIndex]})`
            }}
          >
            <div className="background-overlay" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Login form */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="login-form-container"
      >
        <div className="login-form-card">
          {/* Decorative header */}
          <div className="form-header">
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 10 }}
            >
              <h2 className="form-title">Welcome Back</h2>
              <p className="form-subtitle">Sign in to continue your journey</p>
            </motion.div>
          </div>

          <div className="form-content">
            <form className="form" onSubmit={handleSubmit}>
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="form-fields"
              >
                <div className="form-group">
                  <label htmlFor="email" className="form-label">
                    Email Address
                  </label>
                  <div className="input-container">
                    <div className="input-icon">
                      
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      className={`form-input ${errors.email ? 'input-error' : ''}`}
                      placeholder="your@email.com"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.email && (
                    <motion.p 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="error-message"
                    >
                      <svg className="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      {errors.email}
                    </motion.p>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="password" className="form-label">
                    Password
                  </label>
                  <div className="input-container">
                    <div className="input-icon">
                      
                    </div>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      className={`form-input ${errors.password ? 'input-error' : ''}`}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.password && (
                    <motion.p 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="error-message"
                    >
                      <svg className="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      {errors.password}
                    </motion.p>
                  )}
                </div>
              </motion.div>

              <div className="form-links">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="form-link"
                >
                  <Link 
                    to="/forgot-password"
                    className="link-text"
                  >
                    Forgot password?
                  </Link>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="form-link"
                >
                  <Link 
                    to="/register" 
                    className="link-text"
                  >
                    Create account
                  </Link>
                </motion.div>
              </div>

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
                        Signing in...
                      </>
                    ) : (
                      <>
                        <svg className="button-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 616 0z" clipRule="evenodd" />
                        </svg>
                        Sign in
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
}

export default Login;