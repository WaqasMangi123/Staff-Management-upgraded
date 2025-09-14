import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';

const UserProfile = () => {
  const [user, setUser] = useState(null);
  const [profileData, setProfileData] = useState({
    name: '',
    phone: '',
    profilePicture: '',
    department: '',
    jobTitle: '',
    shift: '',
    workingHours: {
      start: '',
      end: ''
    },
    skills: [],
    yearsWorked: '',
    specialTraining: [''],
    shiftFlexibility: false,
    emergencyContact: {
      name: '',
      relationship: '',
      phone: ''
    },
    notes: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const navigate = useNavigate();

  // Job options based on your Staff model
  const departments = [
    'Cleaning Staff',
    'Event Helpers', 
    'Tea and Snack Staff',
    'Maintenance Staff',
    'Outdoor Cleaners',
    'Office Helpers'
  ];

  const jobTitles = [
    'Classroom Cleaner',
    'Restroom Cleaner', 
    'Floor Care Team',
    'Meeting Attendant',
    'Event Setup Helper',
    'Document Runner',
    'Tea Server',
    'Refreshment Helper',
    'Key Handler',
    'Repair Technician',
    'Waste Collector',
    'Gardener',
    'Outdoor Cleaner',
    'Supply Assistant',
    'General Helper'
  ];

  const shifts = ['Morning', 'Evening', 'Night', 'Flexible'];

  const skillOptions = [
    'Cleaning Areas',
    'Using Tools', 
    'Waste Management',
    'Language Skills',
    'Lab Cleaning',
    'Event Setup',
    'Tea Service',
    'Basic Maintenance'
  ];

  useEffect(() => {
    // Get logged-in user data
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (!token || !userData) {
      navigate('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);

    // Load existing profile data if available
    loadProfileData(parsedUser.id, token);
  }, [navigate]);

  const loadProfileData = async (userId, token) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/auth/profile/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success && response.data.profile) {
        const profile = response.data.profile;
        setProfileData(profile);
        setIsProfileComplete(true);
      }
    } catch (error) {
      // Profile doesn't exist yet, keep default empty form
      console.log('No existing profile found, showing empty form');
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setProfileData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: type === 'checkbox' ? checked : value
        }
      }));
    } else if (type === 'checkbox') {
      setProfileData(prev => ({ ...prev, [name]: checked }));
    } else {
      setProfileData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSkillsChange = (skill) => {
    setProfileData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }));
  };

  const handleSpecialTrainingChange = (index, value) => {
    const newTraining = [...profileData.specialTraining];
    newTraining[index] = value;
    setProfileData(prev => ({ ...prev, specialTraining: newTraining }));
  };

  const addSpecialTraining = () => {
    setProfileData(prev => ({
      ...prev,
      specialTraining: [...prev.specialTraining, '']
    }));
  };

  const removeSpecialTraining = (index) => {
    setProfileData(prev => ({
      ...prev,
      specialTraining: prev.specialTraining.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      
      // Clean up special training array
      const cleanedData = {
        ...profileData,
        userId: user.id,
        specialTraining: profileData.specialTraining.filter(training => training.trim() !== ''),
        yearsWorked: parseInt(profileData.yearsWorked) || 0
      };

      const response = await axios.post('http://localhost:5000/api/auth/update-profile', cleanedData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        toast.success(isProfileComplete ? 'Profile updated successfully!' : 'Profile created successfully!');
        setIsProfileComplete(true);
      }
    } catch (error) {
      if (error.response && error.response.data) {
        toast.error(error.response.data.message || 'Profile update failed');
      } else {
        toast.error('Network error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f5f5f5', 
      padding: '20px',
      fontFamily: 'Arial, sans-serif' 
    }}>
      {/* Header */}
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px 8px 0 0',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h2>Welcome, {user.username || user.name}</h2>
          <p style={{ color: '#666', margin: 0 }}>
            User ID: {user.id} | Email: {user.email}
          </p>
        </div>
        <button 
          onClick={handleLogout}
          style={{
            padding: '8px 16px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Logout
        </button>
      </div>

      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '0 0 8px 8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ color: '#333', marginBottom: '10px' }}>
            {isProfileComplete ? 'Update Your Profile' : 'Complete Your Profile'}
          </h1>
          <p style={{ color: '#666', margin: 0 }}>
            {isProfileComplete ? 'Update your staff information below' : 'Please fill in your detailed information to complete your profile'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Basic Information */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '10px' }}>
              Personal Information
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={profileData.name}
                  onChange={handleChange}
                  required
                  placeholder="Enter your full name"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Phone Number *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={profileData.phone}
                  onChange={handleChange}
                  required
                  placeholder="Enter your phone number"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Profile Picture URL (Optional)
              </label>
              <input
                type="url"
                name="profilePicture"
                value={profileData.profilePicture}
                onChange={handleChange}
                placeholder="Enter image URL"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Job Information */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ color: '#333', borderBottom: '2px solid #28a745', paddingBottom: '10px' }}>
              Job Information
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Department *
                </label>
                <select
                  name="department"
                  value={profileData.department}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Job Title *
                </label>
                <select
                  name="jobTitle"
                  value={profileData.jobTitle}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">Select Job Title</option>
                  {jobTitles.map(title => (
                    <option key={title} value={title}>{title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Preferred Shift *
                </label>
                <select
                  name="shift"
                  value={profileData.shift}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">Select Shift</option>
                  {shifts.map(shift => (
                    <option key={shift} value={shift}>{shift}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Start Time *
                </label>
                <input
                  type="time"
                  name="workingHours.start"
                  value={profileData.workingHours.start}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  End Time *
                </label>
                <input
                  type="time"
                  name="workingHours.end"
                  value={profileData.workingHours.end}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Skills and Experience */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ color: '#333', borderBottom: '2px solid #ffc107', paddingBottom: '10px' }}>
              Skills and Experience
            </h3>

            <div style={{ marginTop: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Skills (Select all that apply)
              </label>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '10px',
                marginTop: '10px'
              }}>
                {skillOptions.map(skill => (
                  <label key={skill} style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={profileData.skills.includes(skill)}
                      onChange={() => handleSkillsChange(skill)}
                      style={{ marginRight: '8px' }}
                    />
                    {skill}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Years of Experience *
              </label>
              <input
                type="number"
                name="yearsWorked"
                value={profileData.yearsWorked}
                onChange={handleChange}
                required
                min="0"
                max="50"
                placeholder="Enter years of experience"
                style={{
                  width: '200px',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginTop: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Special Training/Certifications
              </label>
              {profileData.specialTraining.map((training, index) => (
                <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <input
                    type="text"
                    value={training}
                    onChange={(e) => handleSpecialTrainingChange(index, e.target.value)}
                    placeholder="Enter special training or certification"
                    style={{
                      flex: 1,
                      padding: '12px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '16px'
                    }}
                  />
                  {profileData.specialTraining.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSpecialTraining(index)}
                      style={{
                        padding: '12px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addSpecialTraining}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Add Training
              </button>
            </div>

            <div style={{ marginTop: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  name="shiftFlexibility"
                  checked={profileData.shiftFlexibility}
                  onChange={handleChange}
                  style={{ marginRight: '8px' }}
                />
                <span style={{ fontWeight: 'bold' }}>I am flexible with shift timings</span>
              </label>
            </div>
          </div>

          {/* Emergency Contact */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ color: '#333', borderBottom: '2px solid #dc3545', paddingBottom: '10px' }}>
              Emergency Contact
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Contact Name *
                </label>
                <input
                  type="text"
                  name="emergencyContact.name"
                  value={profileData.emergencyContact.name}
                  onChange={handleChange}
                  required
                  placeholder="Emergency contact name"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Relationship *
                </label>
                <input
                  type="text"
                  name="emergencyContact.relationship"
                  value={profileData.emergencyContact.relationship}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Spouse, Parent, Sibling"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Phone Number *
                </label>
                <input
                  type="tel"
                  name="emergencyContact.phone"
                  value={profileData.emergencyContact.phone}
                  onChange={handleChange}
                  required
                  placeholder="Emergency contact phone"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ color: '#333', borderBottom: '2px solid #17a2b8', paddingBottom: '10px' }}>
              Additional Information
            </h3>

            <div style={{ marginTop: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Additional Notes (Optional)
              </label>
              <textarea
                name="notes"
                value={profileData.notes}
                onChange={handleChange}
                placeholder="Any additional information..."
                rows="4"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div style={{ textAlign: 'center', marginTop: '30px' }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '15px 40px',
                backgroundColor: loading ? '#ccc' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '18px',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.3s'
              }}
            >
              {loading ? 'Saving...' : (isProfileComplete ? 'Update Profile' : 'Save Profile')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserProfile;