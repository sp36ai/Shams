# Firebase Deployment Quick Reference

**Purpose**: Fast track to getting Firebase running  
**Time Estimate**: 30-45 minutes for first deploy

---

## 🚀 Quick Start (5 Commands)

```bash
# 1. Login to Firebase
firebase login

# 2. Install dependencies
cd functions && npm install && cd ..

# 3. Build Cloud Functions
npm --prefix functions run build

# 4. Deploy everything
firebase deploy

# 5. Verify deployment
firebase functions:list
```

---

## ✅ Pre-Deployment Checklist

Before running `firebase deploy`:

- [ ] Created Firebase project at https://console.firebase.google.com
- [ ] Project ID matches `firebaseConfig` in code
- [ ] Enabled Firestore database
- [ ] Enabled Authentication
- [ ] Enabled Cloud Functions
- [ ] Set up billing (required for functions)
- [ ] No sensitive keys in code (use `.env` files)
- [ ] `.gitignore` includes `functions/node_modules`

---

## 🔧 One-Time Setup

### 1. Create Firebase Project
```
1. Go to https://console.firebase.google.com
2. Click "Create a project"
3. Name: "shams-al-asrar"
4. Click "Create project"
5. Wait for setup to complete
```

### 2. Configure Firestore
```
1. In Firebase Console, go to "Firestore Database"
2. Click "Create database"
3. Start in: PRODUCTION MODE
4. Location: us-central1 (or your region)
5. Click "Create"
```

### 3. Enable Services
In Firebase Console, under "Build":
- [ ] Authentication → Enable
- [ ] Firestore Database → Enabled (from step 2)
- [ ] Cloud Functions → Enable
- [ ] Realtime Database (optional)

### 4. Set Billing
```
1. Go to Firebase Console → Project Settings → Billing
2. Link a billing account (required for Cloud Functions)
3. Set up budget alerts (recommended)
```

---

## 📁 File Structure (What Was Generated)

```
shams-al-asrar/
├── firebase.json                 ← Firebase config
├── firestore.rules              ← Security rules
├── firestore.indexes.json       ← Database indexes
├── firebase-emulator.json       ← Local emulator config
├── functions/
│   ├── package.json             ← Dependencies
│   ├── tsconfig.json            ← TypeScript config
│   ├── src/
│   │   ├── index.ts             ← Main exports
│   │   ├── types.ts             ← Type definitions
│   │   ├── config.ts            ← Configuration
│   │   ├── judgment/
│   │   │   └── judgeHorary.ts   ← Calculation engine ⭐
│   │   ├── quotas/
│   │   │   └── quotaCheck.ts    ← Quota management
│   │   ├── readings/
│   │   │   └── submitReading.ts ← Reading storage
│   │   └── security/
│   │       └── verification.ts  ← Security checks
│   └── lib/                     ← Compiled JavaScript (auto-generated)
├── src/
│   └── firebase/
│       ├── client.ts            ← React Native initialization
│       └── examples.ts          ← Usage examples
└── FIREBASE_IMPLEMENTATION_STATUS.md  ← This project status
```

---

## 🔐 Firebase Configuration

Get your config from Firebase Console:

1. Go to Project Settings (⚙️ icon)
2. Click "General"
3. Scroll to "Your apps" section
4. Click on your app
5. Copy the `firebaseConfig` object

Update `src/firebase/client.ts`:
```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "shams-al-asrar.firebaseapp.com",
  projectId: "shams-al-asrar",
  storageBucket: "shams-al-asrar.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

Or use environment variables (recommended):
```bash
# .env file
FIREBASE_API_KEY=xxx
FIREBASE_AUTH_DOMAIN=xxx
FIREBASE_PROJECT_ID=xxx
FIREBASE_STORAGE_BUCKET=xxx
FIREBASE_MESSAGING_SENDER_ID=xxx
FIREBASE_APP_ID=xxx
```

---

## 🚀 Deploy Commands

### Deploy Everything
```bash
firebase deploy
```

### Deploy Only Cloud Functions
```bash
firebase deploy --only functions
```

### Deploy Only Firestore Rules
```bash
firebase deploy --only firestore:rules
```

### Deploy Only Firestore Indexes
```bash
firebase deploy --only firestore:indexes
```

### Deploy with Specific Configuration
```bash
firebase deploy --project shams-al-asrar
```

---

## 🛠️ Local Development (Emulators)

### Start Emulators
```bash
firebase emulators:start
```

Then visit:
- **Firestore Emulator UI**: http://localhost:4000
- **Auth Emulator**: http://localhost:9099
- **Functions**: http://localhost:5001

### Test with Emulator
Functions automatically connect when `__DEV__` is true in `src/firebase/client.ts`.

### Useful Emulator Commands
```bash
# Start specific emulator
firebase emulators:start --only functions

# Start with debugger
firebase emulators:start --inspect-functions

# Export/import data
firebase emulators:export ./export-data
firebase emulators:start --import ./export-data
```

---

## 📊 Monitor Deployment

### Check Function Status
```bash
# List all functions
firebase functions:list

# View function logs
firebase functions:log

# Tail logs in real-time
firebase functions:log --tail
```

### Check Firestore
Go to Firebase Console → Firestore Database:
- View documents
- Check database size
- Monitor usage statistics

### Check Security Rules
Go to Firebase Console → Firestore Database → Rules:
- Review rules
- Simulate rule enforcement
- Test data access

---

## 🐛 Debugging Common Issues

### Issue: "Project not found"
```bash
# Fix: Initialize Firebase in your project
firebase init
```

### Issue: "Functions timeout"
```typescript
// In functions/src/judgment/judgeHorary.ts
.runWith({
  timeoutSeconds: 60  // Increase from 30 to 60
})
```

### Issue: "Firebase SDK not found in React Native"
```bash
# Fix: Install missing dependencies
npm install @react-native-firebase/app
npm install @react-native-firebase/auth
npm install @react-native-firebase/firestore
npm install @react-native-firebase/functions
```

### Issue: "Firestore rules rejected write"
```bash
# Check:
1. User ID matches in write request
2. Document structure matches rules
3. User is authenticated
4. Test in emulator first
```

---

## 📈 Post-Deployment

### 1. Verify Functions are Working
```bash
# Test judgeHorary function
firebase functions:call judgeHorary --data '{"chartData":"{...}","questionType":"career"}'
```

### 2. Check Firestore Rules
Go to Firestore Console → Rules → Publish & Deployment:
- Rules should show as deployed
- Timestamps should be recent

### 3. Monitor Usage
Firebase Console → Usage:
- Cloud Functions invocations
- Firestore read/write operations
- Storage usage
- Set up billing alerts

### 4. Test from App
In React Native app, test:
```typescript
import { submitHoraryQuestion } from '@/firebase/examples';

// Try calling the function
const result = await submitHoraryQuestion(chart, 'career', 28.6139, 77.2090);
console.log(result); // Should show verdict
```

---

## 🔐 Security Checklist After Deployment

- [ ] Firestore rules deployed and enforced
- [ ] API keys restricted (Firebase Console → Restrict keys)
- [ ] Authentication methods limited to needed ones
- [ ] Cloud Functions have proper error handling
- [ ] Audit logging enabled
- [ ] No test data in production
- [ ] Backup enabled (automatic in Firestore)
- [ ] Monitoring alerts configured

---

## 💰 Cost Monitoring

### Expected Monthly Costs (MVP)
```
Firestore reads: $0.06 per 100K = ~$5/month (1M reads)
Firestore writes: $0.18 per 100K = ~$2/month (500K writes)
Cloud Functions: ~$0-10/month (mostly free tier)
Storage: Free (< 1GB)

Total: ~$15-20/month
```

### Set Budget Alert
Firebase Console → Billing:
1. Click "Budget and alerts"
2. Set alert at $50/month
3. Email will alert if exceeded

---

## 🎯 Success Indicators

✅ All working when:
1. `firebase deploy` completes without errors
2. `firebase functions:list` shows all functions
3. Cloud Functions logs show incoming requests
4. Firestore collections populated with test data
5. React Native app successfully calls functions
6. Quota enforcement working (can't bypass from client)
7. Security rules blocking unauthorized access

---

## 📞 Support Resources

- **Firebase Docs**: https://firebase.google.com/docs
- **Cloud Functions**: https://firebase.google.com/docs/functions
- **Firestore**: https://firebase.google.com/docs/firestore
- **React Native Firebase**: https://rnfirebase.io/

---

**Ready? Run**: `firebase deploy`
