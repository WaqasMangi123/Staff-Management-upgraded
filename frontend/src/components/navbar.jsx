import React from 'react';
import { Link } from 'react-router-dom';
import { FaPhoneAlt } from 'react-icons/fa'; // To use the phone icon from react-icons
import './navbar.css';

const Navbar = () => {
  return (
    <nav className="navbar">
      {/* Left side - Logo */}
      <div className="logo">
        <Link to="/">RediGuard Security</Link>
      </div>

      {/* Middle - Navigation Links */}
      <ul className="nav-links">
        <li><Link to="/">Home</Link></li>
        <li><Link to="/about">About</Link></li>
        <li><Link to="/services">Services</Link></li>
        <li><Link to="/recruitment">Recruitment</Link></li>
        <li><Link to="/contact">Contact</Link></li>
      </ul>

      {/* Right side - Telephone and Quote Button */}
      <div className="contact-info">
        <div className="phone-info">
          <FaPhoneAlt className="phone-icon" />
          <span className="phone-number">+123 456 7890</span>
        </div>
        <button className="quote-button">Request a Quote</button>
      </div>
    </nav>
  );
};

export default Navbar;
