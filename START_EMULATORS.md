# Start Firebase Emulators for Local Testing

## Prerequisites
1. Firebase CLI installed: `npm install -g firebase-tools`
2. Functions dependencies installed: `cd functions && npm install`

## Start Emulators

```powershell
# Terminal 1: Start Firebase Emulators
firebase emulators:start

# This will start:
# - Auth Emulator: http://localhost:9099
# - Functions Emulator: http://localhost:5001
# - Firestore Emulator: http://localhost:8282
# - Emulator UI: http://localhost:4000
```

## Configure App to Use Emulators

In `src/firebase/oracle.ts`, change line 22 to use emulator:

```typescript
// Development: use emulator
const fn = firebase.app().functions('asia-south1');
if (__DEV__) {
  fn.useFunctionsEmulator('http://10.0.2.2:5001'); // Android emulator
  // OR fn.useFunctionsEmulator('http://localhost:5001'); // iOS simulator
}
const callable = fn.httpsCallable('askOracle');
```

## Test the Flow

```powershell
# Terminal 2: Start Metro bundler
npm start

# Terminal 3: Run Android app
npm run android
```

Now when you ask a question, it will hit the local emulator instead of production.
