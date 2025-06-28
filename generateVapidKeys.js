// File: scripts/generateVapidKeys.js (Fixed Version)
const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

/**
 * Generate VAPID keys for push notifications
 * Run this script once to generate your VAPID keys
 * Usage: node scripts/generateVapidKeys.js
 */

console.log('🔑 Generating VAPID keys for push notifications...\n');

try {
  // Generate VAPID keys
  const vapidKeys = webpush.generateVAPIDKeys();
  
  console.log('✅ VAPID keys generated successfully!\n');
  console.log('📋 Copy these values to your .env file:\n');
  console.log('----------------------------------------');
  console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
  console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
  console.log(`VAPID_EMAIL=sadhef@biztras.com`);
  console.log('----------------------------------------\n');
  
  // Save to a file for reference
  const keysData = {
    publicKey: vapidKeys.publicKey,
    privateKey: vapidKeys.privateKey,
    email: 'sadhef@biztras.com',
    generatedAt: new Date().toISOString(),
    note: 'Add these keys to your .env file. Keep the private key secure!'
  };
  
  const outputPath = path.join(__dirname, '../vapid-keys.json');
  fs.writeFileSync(outputPath, JSON.stringify(keysData, null, 2));
  
  console.log(`💾 Keys saved to: ${outputPath}`);
  console.log('⚠️  IMPORTANT: Keep your private key secure and never commit it to version control!');
  console.log('\n🔧 Next steps:');
  console.log('1. Add the VAPID keys to your .env file');
  console.log('2. Add the public key to your frontend environment variables');
  console.log('3. Restart your server to apply the changes');
  console.log('4. Test push notifications using the /api/notifications/test endpoint');
  
  // Additional frontend environment variable template
  console.log('\n📱 Frontend Environment Variables (.env.local):');
  console.log('----------------------------------------');
  console.log(`REACT_APP_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
  console.log('----------------------------------------\n');
  
} catch (error) {
  console.error('❌ Error generating VAPID keys:', error);
  process.exit(1);
}