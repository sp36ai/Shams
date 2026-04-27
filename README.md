# Shams al-Asrar

Local Android app for deterministic RKP horary judgment.

## Current shell

- `Ask`: capture a question, build the chart for the current moment and saved location, and judge it immediately
- `History`: review and delete locally saved readings
- `Settings`: theme, language, and location access
- `LocationPermission`: onboarding step for the location needed to cast an RKP chart

The app is local-only. Auth, subscriptions, quotas, cloud sync, Sky Clock, and generic oracle extras have been removed from the active product shell.

## Engine rules

The authoritative rule documents are:

- `docs/RKP_RULES_FROM_SARFARAZ.md`
- `src/astrology/kp/judgment/JUDGMENT_ALGORITHM.md`

The runtime engine is under `src/astrology/`.

## Run

```powershell
npm install
npm start
npm run android
```

## Layout

```text
src/
  astrology/    RKP engine
  components/   shared UI
  i18n/         EN / UR / HI strings
  navigation/   root navigator + tabs
  screens/      splash, permission, ask, history, settings
  storage/      MMKV
  stores/       local readings + settings
  theme/        themes and typography
  types/        ambient TS declarations
  utils/        permissions and logger
```
