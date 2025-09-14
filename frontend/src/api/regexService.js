// services.js - API service functions for Regex Generator
const API_BASE_URL = 'https://regex-wgnk.onrender.com';

class RegexAPIService {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  async healthCheck() {
    return this.makeRequest('/');
  }

  async generateRegex(prompt) {
    return this.makeRequest('/api/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  }

  async testRegex(regex, testString) {
    return this.makeRequest('/api/test', {
      method: 'POST',
      body: JSON.stringify({
        regex: regex,
        test_string: testString
      }),
    });
  }

  async getExamples() {
    return this.makeRequest('/api/examples');
  }
}

// Create and export a singleton instance
export const regexAPI = new RegexAPIService();

// Export individual service functions
export const generateRegex = (prompt) => regexAPI.generateRegex(prompt);
export const testRegex = (regex, testString) => regexAPI.testRegex(regex, testString);
export const getExamples = () => regexAPI.getExamples();
export const healthCheck = () => regexAPI.healthCheck();

export default regexAPI;