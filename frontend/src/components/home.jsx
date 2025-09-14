import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FaUsers,
  FaClock,
  FaCalendarAlt,
  FaChartLine,
  FaShieldAlt,
  FaMobile,
  FaArrowRight,
  FaPlay,
  FaCheckCircle,
  FaStar,
  FaQuoteLeft,
  FaBars,
  FaTimes,
  FaPhone,
  FaEnvelope,
  FaMapMarkerAlt,
  FaDesktop,
  FaTasks,
  FaBell,
  FaUserShield,
  FaAward,
  FaRocket,
  FaGlobe,
  FaLock,
  FaCog,
  FaLightbulb,
  FaBuilding,
  FaGraduationCap
} from 'react-icons/fa';
import './home.css';

const HomePage = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentBg, setCurrentBg] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Background images for hero section
  const backgroundImages = [
    'https://images.unsplash.com/photo-1629904853716-f0bc54eea481?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    'https://images.unsplash.com/photo-1541746972996-4e0b0f43e02a?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    'https://images.unsplash.com/photo-1700241956197-0b13f96fd69e?q=80&w=861&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    'https://images.unsplash.com/photo-1669633760258-186e9dee81e7?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
  ];

  // Features data
  const features = [
    {
      icon: <FaMobile />,
      title: 'Mobile App for Staff',
      description: 'Staff can easily mark attendance, apply for leave, and view assigned tasks through our user-friendly mobile application.'
    },
    {
      icon: <FaDesktop />,
      title: 'Admin Web Dashboard',
      description: 'Comprehensive web dashboard for administrators to manage staff, schedules, and monitor performance efficiently.'
    },
    {
      icon: <FaTasks />,
      title: 'Task Management',
      description: 'Assign, track, and monitor daily tasks with real-time updates and completion status for better productivity.'
    },
    {
      icon: <FaCalendarAlt />,
      title: 'Smart Scheduling',
      description: 'AI-powered scheduling system that automatically assigns shifts based on staff availability and skills.'
    },
    {
      icon: <FaBell />,
      title: 'Real-time Notifications',
      description: 'Instant notifications for schedule changes, leave approvals, and important updates to keep everyone informed.'
    },
    {
      icon: <FaChartLine />,
      title: 'Performance Analytics',
      description: 'Detailed reports and analytics to track attendance, performance, and productivity trends over time.'
    }
  ];

  // Benefits data
  const benefits = [
    {
      title: '50% Faster Scheduling',
      description: 'Reduce scheduling time with automated shift assignments',
      icon: <FaClock />
    },
    {
      title: '99% Attendance Accuracy',
      description: 'Digital attendance tracking eliminates manual errors',
      icon: <FaCheckCircle />
    },
    {
      title: '24/7 Access',
      description: 'Staff can access the system anytime, anywhere',
      icon: <FaShieldAlt />
    },
    {
      title: 'Cost Effective',
      description: 'Reduce administrative costs by up to 40%',
      icon: <FaChartLine />
    }
  ];

  // Testimonials data
  const testimonials = [
    {
      name: 'Dr. Sarah Ahmed',
      position: 'University Administrator',
      image: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80',
      text: 'This system has revolutionized how we manage our cleaning staff. The mobile app is so easy to use!'
    },
    {
      name: 'Muhammad Ali',
      position: 'Facilities Manager',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80',
      text: 'Staff scheduling has never been easier. The AI recommendations save us hours of manual work.'
    },
    {
      name: 'Fatima Khan',
      position: 'HR Director',
      image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80',
      text: 'The performance analytics help us identify top performers and areas for improvement.'
    }
  ];

  // Auto-change background images
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBg((prev) => (prev + 1) % backgroundImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-slide testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % testimonials.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 }
    }
  };

  return (
    <div className="homepage">
      {/* Navigation */}
      <nav className="navbar">
        <div className="nav-container">
          <motion.div 
            className="nav-logo"
            whileHover={{ scale: 1.05 }}
          >
            <FaUserShield className="logo-icon" />
            <span>StaffSync</span>
          </motion.div>

          <div className={`nav-menu ${isMenuOpen ? 'active' : ''}`}>
            <a href="#home" onClick={() => setIsMenuOpen(false)}>Home</a>
            <a href="#features" onClick={() => setIsMenuOpen(false)}>Features</a>
            <a href="#benefits" onClick={() => setIsMenuOpen(false)}>Benefits</a>
            <a href="#about" onClick={() => setIsMenuOpen(false)}>About</a>
            <a href="#contact" onClick={() => setIsMenuOpen(false)}>Contact</a>
            <motion.button
              className="admin-login-btn"
              onClick={() => navigate('/admin-login')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Admin Login
            </motion.button>
          </div>

          <div className="nav-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <FaTimes /> : <FaBars />}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="hero-section">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentBg}
            className="hero-background"
            style={{ backgroundImage: `url(${backgroundImages[currentBg]})` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          />
        </AnimatePresence>
        
        <div className="hero-overlay" />
        
        <motion.div 
          className="hero-content"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.h1 variants={itemVariants} className="hero-title">
            Modern Staff Management
            <span className="highlight"> Made Simple</span>
          </motion.h1>
          
          <motion.p variants={itemVariants} className="hero-subtitle">
            Streamline your workforce with our intelligent staff management system. 
            Mobile app for staff, web dashboard for admins.
          </motion.p>
          
          <motion.div variants={itemVariants} className="hero-buttons">
            <motion.button
              className="cta-button primary"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FaPlay /> Watch Demo
            </motion.button>
            
            <motion.button
              className="cta-button secondary"
              onClick={() => navigate('/admin-login')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Admin Access <FaArrowRight />
            </motion.button>
          </motion.div>
        </motion.div>

        <div className="hero-indicators">
          {backgroundImages.map((_, index) => (
            <button
              key={index}
              className={`indicator ${index === currentBg ? 'active' : ''}`}
              onClick={() => setCurrentBg(index)}
            />
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works">
        <div className="container">
          <motion.div 
            className="section-header"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2>How It Works</h2>
            <p>Simple steps to manage your staff efficiently</p>
          </motion.div>

          <div className="steps-grid">
            {[
              {
                step: "01",
                title: "Staff Download App",
                description: "Staff members download our mobile app and register with their credentials",
                icon: <FaMobile />
              },
              {
                step: "02", 
                title: "Admin Web Access",
                description: "Administrators log in to the web dashboard to manage schedules and assignments",
                icon: <FaDesktop />
              },
              {
                step: "03",
                title: "Smart Scheduling",
                description: "AI automatically assigns tasks based on staff skills and availability",
                icon: <FaCalendarAlt />
              },
              {
  step: "05",
  title: "Performance Analytics",
  description: "Generate comprehensive reports and insights to optimize workforce efficiency and identify improvement opportunities",
  icon: <FaChartLine />,
  color: '#ef4444'
},
{
  step: "06",
  title: "Continuous Optimization",
  description: "System learns from patterns and feedback to automatically improve scheduling accuracy and staff satisfaction over time",
  icon: <FaCog />,
  color: '#06b6d4'
},
              {
                step: "04",
                title: "Real-time Tracking",
                description: "Monitor attendance, tasks, and performance in real-time with notifications",
                icon: <FaChartLine />
              }
              
            ].map((item, index) => (
              <motion.div
                key={index}
                className="step-card"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <div className="step-number">{item.step}</div>
                <div className="step-icon">{item.icon}</div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="container">
          <motion.div 
            className="section-header"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2>Powerful Features</h2>
            <p>Everything you need to manage your staff effectively</p>
          </motion.div>

          <div className="features-grid">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                className="feature-card"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ y: -10, transition: { duration: 0.3 } }}
              >
                <div className="feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="benefits-section">
        <div className="container">
          <div className="benefits-content">
            <motion.div 
              className="benefits-text"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2>Why Choose StaffSync?</h2>
              <p>Transform your staff management with measurable results</p>
              
              <div className="benefits-list">
                {benefits.map((benefit, index) => (
                  <motion.div
                    key={index}
                    className="benefit-item"
                    initial={{ opacity: 0, x: -30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                  >
                    <div className="benefit-icon">{benefit.icon}</div>
                    <div className="benefit-content">
                      <h3>{benefit.title}</h3>
                      <p>{benefit.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div 
              className="benefits-image"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <img 
                src="https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" 
                alt="Team collaboration" 
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="testimonials-section">
        <div className="container">
          <motion.div 
            className="section-header"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2>What Our Clients Say</h2>
            <p>Trusted by organizations worldwide</p>
          </motion.div>

          <div className="testimonial-slider">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                className="testimonial-card"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.5 }}
              >
                <FaQuoteLeft className="quote-icon" />
                <p>"{testimonials[currentSlide].text}"</p>
                <div className="testimonial-author">
                  <img src={testimonials[currentSlide].image} alt={testimonials[currentSlide].name} />
                  <div>
                    <h4>{testimonials[currentSlide].name}</h4>
                    <p>{testimonials[currentSlide].position}</p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="testimonial-dots">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  className={`dot ${index === currentSlide ? 'active' : ''}`}
                  onClick={() => setCurrentSlide(index)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="about-section">
        <div className="container">
          <div className="about-content">
            <motion.div 
              className="about-image"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <img 
                src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" 
                alt="About us" 
              />
            </motion.div>

            <motion.div 
              className="about-text"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2>About StaffSync</h2>
              <p>
                We are dedicated to revolutionizing staff management through innovative technology. 
                Our platform combines the convenience of mobile applications for staff with powerful 
                web-based administrative tools.
              </p>
              <p>
                Built specifically for educational institutions, healthcare facilities, and large 
                organizations, StaffSync streamlines operations while improving staff satisfaction 
                and productivity.
              </p>
              
              <div className="about-stats">
                <div className="stat">
                  <h3>500+</h3>
                  <p>Organizations</p>
                </div>
                <div className="stat">
                  <h3>10K+</h3>
                  <p>Staff Members</p>
                </div>
                <div className="stat">
                  <h3>99.9%</h3>
                  <p>Uptime</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="contact-section">
        <div className="container">
          <motion.div 
            className="section-header"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2>Get In Touch</h2>
            <p>Ready to transform your staff management? Contact us today!</p>
          </motion.div>

          <div className="contact-content">
            <motion.div 
              className="contact-info"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="contact-item">
                <FaPhone className="contact-icon" />
                <div>
                  <h3>Phone</h3>
                  <p>+92 300 1234567</p>
                </div>
              </div>
              
              <div className="contact-item">
                <FaEnvelope className="contact-icon" />
                <div>
                  <h3>Email</h3>
                  <p>info@staffsync.com</p>
                </div>
              </div>
              
              <div className="contact-item">
                <FaMapMarkerAlt className="contact-icon" />
                <div>
                  <h3>Address</h3>
                  <p>Riphah International university,Islamabad, Pakistan</p>
                </div>
              </div>
            </motion.div>

            <motion.div 
              className="contact-cta"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h3>Ready to Get Started?</h3>
              <p>Join hundreds of organizations already using StaffSync</p>
              <motion.button
                className="cta-button primary"
                onClick={() => navigate('/admin-login')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Admin Login <FaArrowRight />
              </motion.button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <FaUserShield className="footer-logo" />
              <h3>StaffSync</h3>
              <p>Modern staff management made simple</p>
            </div>
            
            <div className="footer-links">
              <div>
                <h4>Platform</h4>
                <a href="#features">Features</a>
                <a href="#benefits">Benefits</a>
                <a href="#about">About</a>
              </div>
              
              <div>
                <h4>Access</h4>
                <button onClick={() => navigate('/admin-login')}>Admin Login</button>
                <a href="#">Mobile App</a>
                <a href="#">Documentation</a>
              </div>
              
              <div>
                <h4>Support</h4>
                <a href="#contact">Contact</a>
                <a href="#">Help Center</a>
                <a href="#">Privacy Policy</a>
              </div>
            </div>
          </div>
          
          <div className="footer-bottom">
            <p>&copy; 2025 StaffSync. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;