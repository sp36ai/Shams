# Shams Al-Asrār — Manual QA Test Script

**Version:** v0.2  
**Build type:** Release APK (staging Firebase project)  
**Required:** Two test devices (low-end + mid-range Android), test Firebase accounts

---

## Setup Checklist

- [ ] Firebase Cloud Functions deployed (`askOracle`, `verifyGooglePlayPurchase`)
- [ ] Two Firebase test accounts created: one free-plan, one mureed-plan
- [ ] Play Store sandbox account configured for IAP testing
- [ ] App Check debug token registered in Firebase console
- [ ] Both devices have fresh install (no prior app data)

---

## TC-01: Fresh Install & Splash Screen

**Steps:**
1. Install APK on clean device
2. Launch app

**Expected:**
- Splash screen shows with star animation
- Transitions to AuthScreen within 3 seconds
- No crash or white flash

---

## TC-02: Sign Up (Email)

**Steps:**
1. Tap "Sign Up" tab
2. Submit empty form → verify inline errors appear
3. Enter name: "Test User", email: `testuser@shams.test`, password: `Test1234`
4. Tap "Create Account"

**Expected:**
- Empty submit shows "Enter a valid email address" + "Please enter your name"
- Short password shows "Password must be at least 8 characters"
- Mismatched confirm shows "Passwords do not match"
- Valid submission shows "Account created successfully."
- App proceeds to LocationPermissionScreen

---

## TC-03: Location Permission

**Steps:**
1. After sign-up, observe the location permission screen
2. Tap "Allow" on the system GPS prompt

**Expected:**
- Device GPS prompt fires (NOT hardcoded New Delhi)
- On Allow: coordinates appear in OracleScreen header chip (e.g. `24.86, 67.01`)
- On Deny: chip shows "Location is required"

---

## TC-04: Onboarding (Seeker Profile)

**Steps:**
1. Complete all 3 questions:
   - Q1: "I face a decision and need clarity"
   - Q2: "Directly — I want clear answers"
   - Q3: "Before important choices"
2. Wait for inference spinner
3. Tap "Enter Shams al-Asrār"

**Expected:**
- Screen advances slide-by-slide after each choice (220ms delay)
- Spinner appears on Q3 while Haiku infers the profile
- CTA button appears after inference
- OracleScreen loads after tapping CTA
- Onboarding does NOT reappear on subsequent app opens

---

## TC-05: Oracle — Ask a Horary Question

**Steps:**
1. Type: `Will I get the job I applied for?`
2. Tap "Ask"

**Expected:**
- Loading panel appears: "CASTING THE SACRED CHART"
- Quranic verse displayed during load
- Response appears within 30 seconds
- VerdictCard shows: verdict (YES/NO/CONDITIONAL), confidence %, house hits
- Follow-up chips appear: "When will it happen?", "Why this verdict?", "What remedy?", "New question"

---

## TC-06: Oracle — Follow-up Questions (No Quota Burn)

**Steps:**
1. After receiving a verdict, tap "When will it happen?"
2. Tap "Why this verdict?"
3. Tap "What remedy?"

**Expected:**
- Each follow-up responds instantly (no loading panel, no quota consumed)
- Timing response references a time window (e.g. "3 weeks")
- Why response explains the celestial witness
- Remedy response includes at least one of: Quran verse, asma, dua, zikr, sadaqah
- Quota counter does NOT decrease for follow-ups

---

## TC-07: Oracle — Question Gate (Invalid Input)

**Steps:**
1. Type: `Hello, how are you?` → tap "Ask"
2. Type: `What about my situation?` → tap "Ask"

**Expected:**
- TC7a: Soft redirect: "The oracle awaits a sincere question. What weighs on your heart?"
- TC7b: Soft redirect: "The stars hear your intent — but need more. Who or what does your question concern?"
- **In both cases:** No loading panel, no quota burned, no error state

---

## TC-08: Quota Enforcement (Free Plan)

**Steps:**
1. Log in with free-plan test account
2. Ask 3 different horary questions (exhaust daily quota)
3. Ask a 4th question

**Expected:**
- Questions 1–3 succeed normally
- Question 4 shows quota modal: "The oracle rests"
- "I understand" dismisses modal
- "Unlock unlimited access" link appears only if > 6 hours have passed since exhaustion (not immediately)
- Quota resets at UTC midnight

---

## TC-09: New Question Detection Modal

**Steps:**
1. After receiving a verdict, type: `I have a completely different question — will my visa be approved?`
2. Tap "Ask"

**Expected:**
- Modal appears: "New question detected"
- "Cancel" keeps the current conversation
- "Ask New Question" resets to fresh oracle state with threshold animation

---

## TC-10: Language Switch (RTL)

**Steps:**
1. Navigate to Settings
2. Tap "اردو"
3. Observe OracleScreen and HistoryScreen
4. Tap "हिन्दी"
5. Tap "English" to restore

**Expected:**
- UI switches language immediately (no restart required)
- Urdu: RTL text alignment, Arabic script renders correctly
- Hindi: Devanagari script renders correctly
- Language preference persists after app restart

---

## TC-11: Theme Toggle

**Steps:**
1. In Settings, toggle between light and dark theme

**Expected:**
- All screens update immediately (background, text, borders, chips)
- Starfield background adapts
- Preference persists after app restart

---

## TC-12: History Screen

**Steps:**
1. Ask 3+ questions
2. Navigate to History tab
3. Test filters (YES / NO / CONDITIONAL)
4. Test sort (newest / oldest)

**Expected:**
- All asked questions appear in history
- Filters correctly show only matching verdicts
- Sort order changes correctly
- Tapping a history item shows the full VerdictCard

---

## TC-13: Sky Clock Screen

**Steps:**
1. On OracleScreen, tap "Al-Falak ›" timing strip
2. Observe the Sky Clock panel

**Expected:**
- Screen shows current HORA lord and DAY lord
- Celestial timing data matches the OracleScreen dashboard strip

---

## TC-14: Settings — Reset Spiritual Profile

**Steps:**
1. In Settings, tap "Reset spiritual profile"
2. Confirm in the alert dialog

**Expected:**
- Alert: "You will be returned to the onboarding questions on your next app open."
- On next app open, Onboarding screen appears again

---

## TC-15: In-App Purchase (Sandbox)

**Steps:**
1. Log in with free-plan test account
2. Navigate to Premium screen (via quota modal or Settings)
3. Tap the Mureed subscription button
4. Complete purchase with Play Store sandbox account

**Expected:**
- Plan upgrades to "✦ Mureed" in Settings
- Quota shows "Unlimited readings"
- Oracle allows unlimited questions

---

## TC-16: No Internet — Graceful Degradation

**Steps:**
1. Enable Airplane Mode
2. Try to ask a question

**Expected:**
- App does not crash
- Error message appears: references network/server issue
- Previously cached readings still visible in History

---

## TC-17: Sign Out

**Steps:**
1. In Settings, tap "Sign Out"
2. Confirm in the alert dialog

**Expected:**
- App returns to AuthScreen
- All local data cleared (readings NOT preserved — confirm with PM)
- Can sign back in with same account

---

## TC-18: Low-End Device Performance

Run TC-05 on the low-end test device.

**Expected:**
- StarfieldBackground animates at ≥ 30 fps (no jank)
- No ANR (App Not Responding) dialogs
- VerdictCard renders within 1 second of receiving oracle response

---

## Sign-Off Criteria

All TCs must pass on **both** test devices before release.  
Any P0/P1 bug (crash, data loss, incorrect quota, wrong location) blocks release.
