import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import "./emailverification.css";

function VerifyEmail() {
  const [verificationCode, setVerificationCode] = useState("");
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [codeInputs, setCodeInputs] = useState(['', '', '', '', '', '']);
  const [focusedInput, setFocusedInput] = useState(null);
  const navigate = useNavigate();

  // Container animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.8,
        staggerChildren: 0.2
      }
    }
  };

  // Card animation variants
  const cardVariants = {
    hidden: { 
      opacity: 0, 
      y: 60, 
      scale: 0.95
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.8,
        type: "spring",
        stiffness: 100,
        damping: 15
      }
    },
    hover: {
      y: -5,
      scale: 1.02,
      transition: {
        duration: 0.3,
        type: "spring",
        stiffness: 400,
        damping: 25
      }
    }
  };

  // Input animation variants
  const inputVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.5,
        type: "spring",
        stiffness: 300,
        damping: 20
      }
    },
    focus: {
      scale: 1.02,
      y: -2,
      transition: {
        duration: 0.2,
        type: "spring",
        stiffness: 400,
        damping: 25
      }
    }
  };

  // Button animation variants
  const buttonVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        delay: 0.3
      }
    },
    hover: {
      y: -3,
      scale: 1.02,
      transition: {
        duration: 0.2,
        type: "spring",
        stiffness: 400,
        damping: 25
      }
    },
    tap: {
      scale: 0.98,
      y: -1
    }
  };

  // Code input animation variants
  const codeInputVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: (index) => ({
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.4,
        delay: index * 0.1,
        type: "spring",
        stiffness: 300,
        damping: 20
      }
    }),
    focus: {
      scale: 1.1,
      transition: {
        duration: 0.2
      }
    }
  };

  // Handle individual code input changes
  const handleCodeInputChange = (index, value) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newInputs = [...codeInputs];
      newInputs[index] = value;
      setCodeInputs(newInputs);
      
      // Auto-focus next input
      if (value && index < 5) {
        const nextInput = document.querySelector(`#code-input-${index + 1}`);
        if (nextInput) nextInput.focus();
      }
      
      // Update verification code
      const fullCode = newInputs.join('');
      setVerificationCode(fullCode);
    }
  };

  // Handle backspace in code inputs
  const handleCodeInputKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !codeInputs[index] && index > 0) {
      const prevInput = document.querySelector(`#code-input-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleVerification = async () => {
    if (!email.trim()) {
      setErrorMessage("Please enter your email.");
      return;
    }

    if (!/^\d{6}$/.test(verificationCode)) {
      setErrorMessage("Please enter a valid 6-digit verification code.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch("https://parksy-backend.onrender.com/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), verificationCode: verificationCode.trim() }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccessMessage(result.message);
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      } else {
        setErrorMessage(result.message || "❌ Invalid verification code.");
      }
    } catch (error) {
      setErrorMessage("❌ An error occurred during verification. Please try again.");
    }

    setLoading(false);
  };

  // Message animation variants
  const messageVariants = {
    hidden: { 
      opacity: 0, 
      y: 20, 
      scale: 0.95 
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.4,
        type: "spring",
        stiffness: 300,
        damping: 20
      }
    },
    exit: {
      opacity: 0,
      y: -20,
      scale: 0.95,
      transition: {
        duration: 0.4
      }
    }
  };

  // Loading animation variants
  const loadingVariants = {
    animate: {
      rotate: 360,
      transition: {
        duration: 1,
        repeat: Infinity,
        ease: "linear"
      }
    }
  };

  return (
    <motion.div 
      className="verify-container"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div 
        className="verify-card"
        variants={cardVariants}
        whileHover="hover"
        style={{ perspective: "1000px" }}
      >
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Email Verification
        </motion.h2>
        
        <motion.p 
          className="verify-subtext"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          A 6-digit verification code has been sent to your email. Please check your inbox.
        </motion.p>

        <motion.input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          className="verify-input"
          variants={inputVariants}
          whileFocus="focus"
          initial="hidden"
          animate="visible"
        />

        <motion.div 
          className="code-inputs-container"
          style={{ 
            display: 'flex', 
            gap: '12px', 
            justifyContent: 'center',
            marginBottom: '1.5rem' 
          }}
        >
          {codeInputs.map((digit, index) => (
            <motion.input
              key={index}
              id={`code-input-${index}`}
              type="text"
              value={digit}
              onChange={(e) => handleCodeInputChange(index, e.target.value)}
              onKeyDown={(e) => handleCodeInputKeyDown(index, e)}
              onFocus={() => setFocusedInput(index)}
              onBlur={() => setFocusedInput(null)}
              maxLength="1"
              style={{
                width: '50px',
                height: '60px',
                textAlign: 'center',
                fontSize: '1.5rem',
                fontWeight: '600',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                color: 'white',
                outline: 'none',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              variants={codeInputVariants}
              custom={index}
              initial="hidden"
              animate="visible"
              whileFocus="focus"
            />
          ))}
        </motion.div>

        <motion.button
          onClick={handleVerification}
          disabled={loading}
          className="verify-button"
          variants={buttonVariants}
          whileHover="hover"
          whileTap="tap"
        >
          {loading ? (
            <motion.div
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <motion.div
                style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTop: '2px solid white',
                  borderRadius: '50%'
                }}
                variants={loadingVariants}
                animate="animate"
              />
              Verifying...
            </motion.div>
          ) : (
            "Submit"
          )}
        </motion.button>

        <AnimatePresence mode="wait">
          {errorMessage && (
            <motion.p
              className="verify-error"
              variants={messageVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              key="error"
            >
              {errorMessage}
            </motion.p>
          )}
          
          {successMessage && (
            <motion.p
              className="verify-success"
              variants={messageVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              key="success"
            >
              {successMessage}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

export default VerifyEmail;