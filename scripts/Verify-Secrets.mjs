/**
 * Verify-Secrets.mjs — Production Readiness Check
 * --------------------------------------------------------------------------
 * Checks if Secret Manager secrets exist and are accessible.
 * Run: node scripts/Verify-Secrets.mjs
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();
const projectId = 'shams-app-4d0e7';
const requiredSecrets = [
  'RAZORPAY_WEBHOOK_SECRET',
  'GOOGLE_PLAY_CLIENT_EMAIL',
  'GOOGLE_PLAY_PRIVATE_KEY',
  'ANTHROPIC_API_KEY'
];

async function verify() {
  console.log(`🔍 Verifying Secret Manager for: ${projectId}\n`);
  let allPassed = true;

  for (const secretName of requiredSecrets) {
    const name = `projects/${projectId}/secrets/${secretName}`;
    try {
      const [secret] = await client.getSecret({ name });
      const [version] = await client.getSecretVersion({ name: `${name}/versions/latest` });
      
      console.log(`✅ ${secretName.padEnd(25)} : OK (State: ${version.state})`);
    } catch (err) {
      allPassed = false;
      if (err.code === 5) {
        console.log(`❌ ${secretName.padEnd(25)} : MISSING (Not found in Secret Manager)`);
      } else if (err.code === 7) {
        console.log(`❌ ${secretName.padEnd(25)} : ACCESS DENIED (Check IAM permissions)`);
      } else {
        console.log(`❌ ${secretName.padEnd(25)} : ERROR (${err.message})`);
      }
    }
  }

  if (!allPassed) {
    console.log('\n🚨 Verification FAILED. Please check the logs above.');
    process.exit(1);
  }
  console.log('\n✨ All production secrets are provisioned and accessible.');
}

verify();