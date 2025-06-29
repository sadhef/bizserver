// api/config/firebase-admin.js
const admin = require('firebase-admin');

// Your Firebase service account credentials
const serviceAccount = {
  type: "service_account",
  project_id: "biztras-4a141",
  private_key_id: "301d5b519cd0d60dd33a536cc511e9c5fa83b908",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDYG/6ryrn6H/RI\nkfXSy0NKkeHk49n7cmYGVPbmmDvHjzlGYov9yV633P0i1N8c9xBI6e4v6yTexYo1\nhbHDL8kNbgZ07wzIeXoun37TexTOkDFLr7KLMTnMy4CSowP4akJmfXvT9NUxMib/\nXqE1PMMjY+3/JHDIasSCAv3OZM4rSc6XHhMjqIER3SFjzBFLQ+YTPjnnI6FknSIb\nEFm3eAIiAAjLsRSObzGbE7A7p0PJayR15yYcZQlx5kW6C8TBWiOIVSm03huh1pq5\nl+p9p0l2khN3oSHXuqmLiu/IFgCnZAzI4tUnVpAxTsixnz12Z7vMaUpIQNIgeOLj\nkik6fNh3AgMBAAECggEAXMkYPNYbp2KU1Zulec2/pIKiBE43xxfE6i8MmtD9yZ6a\nrrec92e//R0qqgvPh3YkTcnydCx3dhZGUtiGDBG2NsfoicghKunNJbthDpenxVBv\nedmDxPNrp5wwJcVL7RpiS/LQeZ6C8k5gJACTInJmLgm3o3YX3lTI7jEum7D4O+j4\nMLszP2bfLEYVc8ntsAGZU9KEenuMVAHDGqW4YjwWPST4iQBg411bM4PSmrMzgzxu\nTY1qjl9oRc9J6gpiuvjZc3YMlpbv2B48CuSQttnmdkWK0eXMaTMPxkO+9Iu2vbIh\nH8EZRPVM17Ivdffbi9RoFRizCfwO5qjJYdfWi8zOAQKBgQD5eFyCEXsngQbm3HSN\n7lyhPxr89Mz/GTt9aDaESMgbotPRW92b4apC9HYkoGnSwTbl6BNk3XYWIUGxbL0e\naUGG8ocKsVJ4QLq+3TxUO7IkrVy7edaQ6+u8te2tKLY/1jYu+6U3YtEXtSPcjvDE\nsdW5tYXeEK1WEokEtKfxD/3E9wKBgQDdxBdAgv3RDHeqlL1hGbGYvGAClTX7n3I/\nCJ6Yo8wLmwBr7sDW82wYE0XW4O6941uNTn1EpC0szav803tnrs3XHnZAhm8RBN9W\nXUoRV0ca2XBvO5j6pjHwaDAOA+IBw5192udk54/OzEaD6D34V9TOfW8hcYCWy8wY\nGHMtaloogQKBgQCfjETNwtRazYBWgcPhSgLf9XYTNZUtyTts1wuWyt2AH0EM8o3m\ntgqoS6SLhDRp37x2iVht990gBiD3ki3Zl0ObRNztD79IvU0x6Fg/Hvat0louZJu/\nj8Lyq//X8OOuLBf3MGXX6FEFsom+84Q0p++il9+HyG6zT6Nl6QxHdgy8vQKBgQCQ\n4A/Ip0qljR2IJM9rZdutyjJ2vX+cuFdscncZhLhCRKqL2FfGlRPizoRrklqlVqhy\nsfoII7EXee2Hp6kQ3RPAGzhpgumAFszIoP1IQtpC4hYftLGF3Zj2UzpBjavSNzbm\nB2Hve49pK+5NMiV53fc6RpuZH4s/+DeG7kIgQ0BPAQKBgQDgg8zTzR8ii7O63RHM\n/UjMlRZNcbqC34oxmqkKIbyHgHrFqDwpRl1tZrkaQyE/7dJIN/b9WRunmkqr/sp9\nWejJmd1/Rc3CjJyzrl4X+wNlaqNAGkpUkJq6RWvzlNMFotYknLjTktoaiXPwm9ae\nXOcW0SJoyPo8ShozSoRb0cGpVA==\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@biztras-4a141.iam.gserviceaccount.com",
  client_id: "113355711694552959943",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40biztras-4a141.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'biztras-4a141',
    });
    console.log('✅ Firebase Admin SDK initialized successfully with project: biztras-4a141');
    console.log('🔔 Push notification service ready!');
  } catch (error) {
    console.error('❌ Firebase Admin SDK initialization failed:', error);
    
    // Create a mock admin object for development if initialization fails
    const mockAdmin = {
      messaging: () => ({
        send: async (message, dryRun = false) => {
          console.log('🔄 Mock notification send:', {
            title: message.notification?.title,
            body: message.notification?.body,
            token: message.token?.substring(0, 20) + '...',
            dryRun
          });
          return { messageId: `mock-${Date.now()}` };
        },
        sendMulticast: async (message) => {
          console.log('🔄 Mock multicast send:', {
            title: message.notification?.title,
            body: message.notification?.body,
            tokenCount: message.tokens?.length || 0
          });
          return {
            successCount: message.tokens?.length || 1,
            failureCount: 0,
            responses: (message.tokens || ['mock']).map(() => ({ success: true }))
          };
        }
      })
    };
    
    module.exports = mockAdmin;
    return;
  }
}

module.exports = admin;