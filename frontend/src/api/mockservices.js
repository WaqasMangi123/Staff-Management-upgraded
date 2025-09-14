// mockServices.js - Mock version for testing frontend

// Simulate API delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class MockRegexAPIService {
  constructor() {
    this.baseUrl = 'http://localhost:3000'; // Mock URL
  }

  async healthCheck() {
    await delay(500); // Simulate network delay
    return {
      status: "healthy",
      service: "Smart AI Regex Generator (MOCK)",
      powered_by: "Mock Service",
      timestamp: new Date().toISOString(),
      endpoints: {
        generate: "/api/generate (POST)",
        test: "/api/test (POST)",
        health: "/ (GET)"
      }
    };
  }

  async generateRegex(prompt) {
    await delay(1000); // Simulate processing time
    
    // Mock responses based on prompt keywords
    const mockRegexPatterns = {
      email: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b',
      phone: '\\(?\\d{3}\\)?[-.]?\\d{3}[-.]?\\d{4}',
      date: '\\d{1,2}/\\d{1,2}/\\d{4}',
      url: 'https?://[\\w\\-]+(\\.[\\w\\-]+)+([\\w\\-\\.,@?^=%&:/~\\+#]*[\\w\\-\\@?^=%&/~\\+#])?',
      number: '\\d+',
      word: '\\b\\w+\\b',
      default: '[A-Za-z0-9]+'
    };

    let regex = mockRegexPatterns.default;
    let fullResponse = `REGEX: ${regex}\n\nThis is a mock response for testing purposes.`;

    // Simple keyword matching
    const lowerPrompt = prompt.toLowerCase();
    if (lowerPrompt.includes('email')) {
      regex = mockRegexPatterns.email;
      fullResponse = `REGEX: ${regex}\n\nThis pattern matches standard email addresses including Gmail, Yahoo, and other common formats.`;
    } else if (lowerPrompt.includes('phone')) {
      regex = mockRegexPatterns.phone;
      fullResponse = `REGEX: ${regex}\n\nThis pattern matches US phone numbers in various formats including (123) 456-7890, 123-456-7890, and 123.456.7890.`;
    } else if (lowerPrompt.includes('date')) {
      regex = mockRegexPatterns.date;
      fullResponse = `REGEX: ${regex}\n\nThis pattern matches dates in MM/DD/YYYY format.`;
    } else if (lowerPrompt.includes('url')) {
      regex = mockRegexPatterns.url;
      fullResponse = `REGEX: ${regex}\n\nThis pattern matches HTTP and HTTPS URLs.`;
    }

    return {
      success: true,
      prompt: prompt,
      regex: regex,
      full_response: fullResponse,
      timestamp: new Date().toISOString()
    };
  }

  async testRegex(regex, testString) {
    await delay(500);
    
    try {
      const regexPattern = new RegExp(regex, 'g');
      const matches = Array.from(testString.matchAll(regexPattern), match => match[0]);
      
      return {
        success: true,
        regex: regex,
        test_string: testString,
        matches: matches,
        match_count: matches.length,
        is_valid: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: `Invalid regex: ${error.message}`,
        matches: [],
        match_count: 0,
        is_valid: false,
        timestamp: new Date().toISOString()
      };
    }
  }

  async getExamples() {
    await delay(300);
    
    return {
      examples: {
        email: [
          "Match email addresses",
          "Validate Gmail addresses only",
          "Email with specific domain validation"
        ],
        phone: [
          "US phone numbers with area code",
          "International phone format",
          "Phone numbers with extensions"
        ],
        dates: [
          "Match dates in MM/DD/YYYY format",
          "European date format DD-MM-YYYY",
          "ISO date format YYYY-MM-DD"
        ],
        web: [
          "Extract URLs from text",
          "Match IPv4 addresses",
          "Find domain names"
        ],
        text: [
          "Words starting with capital letter",
          "Extract hashtags from text",
          "Match alphanumeric codes"
        ]
      },
      total_categories: 5,
      timestamp: new Date().toISOString()
    };
  }
}

// Create and export mock instance
export const mockRegexAPI = new MockRegexAPIService();

// Export individual service functions
export const generateRegex = (prompt) => mockRegexAPI.generateRegex(prompt);
export const testRegex = (regex, testString) => mockRegexAPI.testRegex(regex, testString);
export const getExamples = () => mockRegexAPI.getExamples();
export const healthCheck = () => mockRegexAPI.healthCheck();

export default mockRegexAPI;