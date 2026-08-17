/**
 * AuthScreen — sign in / sign up with email + password.
 * --------------------------------------------------------------------------
 * Two tabs: Sign In | Create Account.
 * Validates locally before calling Firebase Auth so the user gets instant
 * feedback without burning a network round-trip on obvious typos.
 *
 * Security:
 *   - Password is never stored, only passed directly to auth().
 *   - secureTextEntry hides the password field from device screenshot APIs.
 *   - Error messages are normalised — Firebase error codes are mapped to
 *     app strings so internal error details are never leaked to the UI.
 */

import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import crashlytics from '@react-native-firebase/crashlytics';

import { useColors, useTheme } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useTranslation } from '@i18n/I18nProvider';
import { useAuthStore } from '@stores/authStore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID } from '@stores/authStore';
import StarfieldBackground from '@components/StarfieldBackground';

/* -------------------------------------------------------------------------- */
/*  Form state machine                                                        */
/* -------------------------------------------------------------------------- */

type Tab = 'signIn' | 'signUp';

interface FormState {
  tab: Tab;
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  showPassword: boolean;
  emailError: string;
  passwordError: string;
  confirmError: string;
  nameError: string;
}

type FormAction =
  | { type: 'SET_TAB'; tab: Tab }
  | { type: 'SET_EMAIL'; value: string }
  | { type: 'SET_PASSWORD'; value: string }
  | { type: 'SET_CONFIRM'; value: string }
  | { type: 'SET_NAME'; value: string }
  | { type: 'TOGGLE_SHOW_PASSWORD' }
  | {
      type: 'SET_ERRORS';
      emailError?: string;
      passwordError?: string;
      confirmError?: string;
      nameError?: string;
    }
  | { type: 'CLEAR_ERRORS' };

const initialForm: FormState = {
  tab: 'signIn',
  email: '',
  password: '',
  confirmPassword: '',
  name: '',
  showPassword: false,
  emailError: '',
  passwordError: '',
  confirmError: '',
  nameError: '',
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_TAB':
      return { ...initialForm, tab: action.tab };
    case 'SET_EMAIL':
      return { ...state, email: action.value, emailError: '' };
    case 'SET_PASSWORD':
      return { ...state, password: action.value, passwordError: '' };
    case 'SET_CONFIRM':
      return { ...state, confirmPassword: action.value, confirmError: '' };
    case 'SET_NAME':
      return { ...state, name: action.value, nameError: '' };
    case 'TOGGLE_SHOW_PASSWORD':
      return { ...state, showPassword: !state.showPassword };
    case 'SET_ERRORS':
      return {
        ...state,
        emailError: action.emailError ?? state.emailError,
        passwordError: action.passwordError ?? state.passwordError,
        confirmError: action.confirmError ?? state.confirmError,
        nameError: action.nameError ?? state.nameError,
      };
    case 'CLEAR_ERRORS':
      return { ...state, emailError: '', passwordError: '', confirmError: '', nameError: '' };
    default:
      return state;
  }
}

/* -------------------------------------------------------------------------- */
/*  Validation                                                                */
/* -------------------------------------------------------------------------- */

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

const AuthScreen: React.FC = () => {
  const { theme } = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();

  const isLoading = useAuthStore(s => s.isLoading);
  const lockoutUntil = useAuthStore(s => s.lockoutUntil);
  const signIn = useAuthStore(s => s.signIn);
  const signUp = useAuthStore(s => s.signUp);
  const signInWithGoogle = useAuthStore(s => s.signInWithGoogle);
  const clearError = useAuthStore(s => s.clearError);

  // Live countdown while sign-in is locally locked out after repeated failures.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (lockoutUntil === null || lockoutUntil <= Date.now()) {
      return;
    }
    const id = setInterval(() => setNowTick(Date.now()), 500);
    return () => clearInterval(id);
  }, [lockoutUntil]);
  const lockRemainingSec =
    lockoutUntil !== null ? Math.max(0, Math.ceil((lockoutUntil - nowTick) / 1000)) : 0;
  const isLocked = lockRemainingSec > 0;

  // Configure Google Sign-In once on mount
  React.useEffect(() => {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  }, []);

  const [form, dispatch] = useReducer(formReducer, initialForm);
  const [serverError, setServerError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  // When a handler sets a notice AND programmatically changes a form field in
  // the same commit (e.g. duplicate-account → switch to Sign In + prefill
  // email), the "dismiss on keypress" effect below would otherwise wipe that
  // notice on the very next render. This flag suppresses exactly one such pass.
  const keepNoticeRef = useRef(false);

  // Error/success display is driven entirely from the handler return values
  // below (each normalised via normaliseAuthError). We intentionally do NOT
  // mirror authStore.error into serverError via an effect — doing both raced
  // two writers against each other and could clobber a just-set notice.

  // Dismiss messages on next real keypress (not on programmatic field changes).
  useEffect(() => {
    if (keepNoticeRef.current) {
      keepNoticeRef.current = false;
      return;
    }
    setServerError('');
    setSuccessMsg('');
  }, [form.email, form.password, form.confirmPassword, form.name]);

  const handleSubmit = useCallback(async () => {
    dispatch({ type: 'CLEAR_ERRORS' });
    setServerError('');
    setSuccessMsg('');
    clearError();

    // ── Local validation ──────────────────────────────────────────────
    let valid = true;
    if (!isValidEmail(form.email)) {
      dispatch({ type: 'SET_ERRORS', emailError: t('auth.invalidEmail') });
      valid = false;
    }
    if (form.password.length < 8) {
      dispatch({ type: 'SET_ERRORS', passwordError: t('auth.weakPassword') });
      valid = false;
    }
    if (form.tab === 'signUp') {
      if (form.password !== form.confirmPassword) {
        dispatch({ type: 'SET_ERRORS', confirmError: t('auth.passwordMismatch') });
        valid = false;
      }
      if (form.name.trim().length === 0) {
        dispatch({ type: 'SET_ERRORS', nameError: t('auth.nameRequired') });
        valid = false;
      }
    }
    if (!valid) {
      return;
    }

    // ── Network call ──────────────────────────────────────────────────
    if (form.tab === 'signIn') {
      const error = await signIn(form.email.trim(), form.password);
      if (error) {
        // If this failure tripped (or hit an active) local lockout, the live
        // countdown banner speaks for itself — don't also show a wrong-password
        // line underneath it.
        if (useAuthStore.getState().lockoutUntil !== null) {
          setServerError('');
        } else {
          setServerError(normaliseAuthError(error.message, t));
        }
      }
    } else {
      const error = await signUp(form.email.trim(), form.password, form.name.trim());
      if (error) {
        // An existing-email collision is not a dead end — route the seeker to
        // the Sign In tab (pre-filling their email) with an in-voice nudge,
        // instead of a generic "could not create account".
        if (error.message.toLowerCase().includes('email-already-in-use')) {
          const existingEmail = form.email.trim();
          keepNoticeRef.current = true;
          dispatch({ type: 'SET_TAB', tab: 'signIn' });
          dispatch({ type: 'SET_EMAIL', value: existingEmail });
          setServerError(t('auth.accountExists'));
        } else {
          setServerError(normaliseAuthError(error.message, t));
        }
      } else {
        setSuccessMsg(t('auth.accountCreated'));
      }
    }
  }, [form, t, clearError, signIn, signUp]);

  const handleGoogleSignIn = useCallback(async () => {
    setServerError('');
    setSuccessMsg('');
    clearError();
    const error = await signInWithGoogle();
    if (error) {
      setServerError(normaliseAuthError(error.message, t));
    }
  }, [clearError, signInWithGoogle, t]);

  const handleForgotPassword = useCallback(async () => {
    if (!isValidEmail(form.email)) {
      return dispatch({ type: 'SET_ERRORS', emailError: t('auth.invalidEmail') });
    }
    try {
      await auth().sendPasswordResetEmail(form.email.trim());
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      // AuthScreen's normaliseAuthError() deliberately discards this raw message
      // in production ([auth/<code> ...]) once none of its known substrings match,
      // showing only a generic "unexpected error" — which means an unrecognized/new
      // Firebase Auth error code would otherwise vanish with no record anywhere.
      // Crashlytics is the only place it survives to be diagnosed from.
      crashlytics().recordError(error instanceof Error ? error : new Error(msg));
      setServerError(msg ? normaliseAuthError(msg, t) : t('errors.unknown'));
      return;
    }
    setSuccessMsg(t('auth.resetLinkSent'));
  }, [form.email, t]);

  const isSignUp = form.tab === 'signUp';
  const submitLabel = isSignUp ? t('auth.signUp') : t('auth.signIn');
  // A live lockout countdown takes precedence over any lingering error line.
  const displayError = isLocked
    ? t('errors.tooManyAttempts', { seconds: lockRemainingSec })
    : serverError;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]}>
      {/* Premium starfield backdrop */}
      <StarfieldBackground
        starColor={colors.starfield}
        nebula1={colors.nebula1}
        nebula2={colors.nebula2}
        nebula3={colors.nebula3}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        // Android already resizes the window via android:windowSoftInputMode=
        // "adjustResize" (see AndroidManifest.xml), so applying a 'height'
        // behavior here double-adjusts and pushes fields off-screen. Let the
        // OS resize + the ScrollView handle Android; only iOS needs 'padding'.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* App wordmark — premium glow treatment */}
          <View style={styles.brand}>
            {/* Accent glow behind the wordmark */}
            <View
              pointerEvents="none"
              style={[
                styles.brandGlow,
                {
                  backgroundColor: colors.nebula1,
                  shadowColor: colors.accent,
                  shadowRadius: 40,
                  shadowOpacity: 0.5,
                  shadowOffset: { width: 0, height: 0 },
                },
              ]}
            />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
              style={[
                typography('hero'),
                {
                  color: colors.goldBright,
                  textAlign: 'center',
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  width: '100%',
                },
              ]}
            >
              {'SHAMS AL-ASRĀR'}
            </Text>
            <Text
              style={[
                typography('caption'),
                { color: colors.textFaint, textAlign: 'center', marginTop: 4, letterSpacing: 2.5 },
              ]}
            >
              {'✦  KP HORARY ORACLE  ✦'}
            </Text>
          </View>

          {/* Form glass card */}
          {/* Tab row */}
          <View style={[styles.tabRow, { borderColor: colors.border }]}>
            <TabButton
              label={t('auth.signInTab')}
              active={form.tab === 'signIn'}
              onPress={() => dispatch({ type: 'SET_TAB', tab: 'signIn' })}
              colors={colors}
              typography={typography}
              testID="auth-tab-signin"
            />
            <TabButton
              label={t('auth.signUpTab')}
              active={form.tab === 'signUp'}
              onPress={() => dispatch({ type: 'SET_TAB', tab: 'signUp' })}
              colors={colors}
              typography={typography}
              testID="auth-tab-signup"
            />
          </View>

          {/* Form */}
          <View
            style={[
              styles.form,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            ]}
          >
            {isSignUp && (
              <Field
                testID="auth-input-name"
                label={t('auth.name')}
                value={form.name}
                error={form.nameError}
                autoCapitalize="words"
                returnKeyType="next"
                onChangeText={v => dispatch({ type: 'SET_NAME', value: v })}
                onSubmitEditing={() => passwordRef.current?.focus()}
                colors={colors}
                typography={typography}
              />
            )}

            <Field
              testID="auth-input-email"
              label={t('auth.email')}
              value={form.email}
              error={form.emailError}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              onChangeText={v => dispatch({ type: 'SET_EMAIL', value: v })}
              onSubmitEditing={() => passwordRef.current?.focus()}
              colors={colors}
              typography={typography}
            />

            <Field
              ref={passwordRef}
              testID="auth-input-password"
              label={t('auth.password')}
              value={form.password}
              error={form.passwordError}
              secureTextEntry={!form.showPassword}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              returnKeyType={isSignUp ? 'next' : 'done'}
              onChangeText={v => dispatch({ type: 'SET_PASSWORD', value: v })}
              onSubmitEditing={() => (isSignUp ? confirmRef.current?.focus() : void handleSubmit())}
              rightLabel={form.showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              onRightPress={() => dispatch({ type: 'TOGGLE_SHOW_PASSWORD' })}
              colors={colors}
              typography={typography}
            />

            {isSignUp && (
              <Field
                ref={confirmRef}
                testID="auth-input-confirm"
                label={t('auth.confirmPassword')}
                value={form.confirmPassword}
                error={form.confirmError}
                secureTextEntry={!form.showPassword}
                autoComplete="new-password"
                returnKeyType="done"
                onChangeText={v => dispatch({ type: 'SET_CONFIRM', value: v })}
                onSubmitEditing={() => void handleSubmit()}
                colors={colors}
                typography={typography}
              />
            )}

            {displayError.length > 0 && (
              <View
                style={[
                  styles.serverError,
                  { borderColor: colors.negative, backgroundColor: `${colors.negative}14` },
                ]}
              >
                <Text style={[typography('caption'), { color: colors.negative }]}>
                  {displayError}
                </Text>
              </View>
            )}

            {successMsg.length > 0 && (
              <View
                style={[
                  styles.successBox,
                  { borderColor: colors.accent, backgroundColor: `${colors.accent}12` },
                ]}
              >
                <Text style={[typography('caption'), { color: colors.accent }]}>{successMsg}</Text>
              </View>
            )}

            <Pressable
              onPress={() => void handleSubmit()}
              disabled={isLoading || isLocked}
              testID="auth-submit-btn"
              style={({ pressed }) => [
                styles.submitBtn,
                {
                  backgroundColor: isLoading || isLocked ? colors.surfaceElevated : colors.primary,
                  // 3D press: colored shadow + slight scale
                  shadowColor: colors.accent,
                  shadowRadius: pressed ? 4 : 12,
                  shadowOpacity: pressed ? 0.2 : 0.5,
                  shadowOffset: { width: 0, height: pressed ? 1 : 4 },
                  elevation: pressed ? 2 : 6,
                  transform: [{ scale: pressed ? 0.975 : 1 }],
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={submitLabel}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text
                  style={[typography('button'), { color: colors.textOnPrimary, letterSpacing: 1 }]}
                >
                  {submitLabel}
                </Text>
              )}
            </Pressable>

            <View style={styles.toggleRow}>
              <Text style={[typography('caption'), { color: colors.textMuted }]}>
                {isSignUp ? t('auth.haveAccount') : t('auth.noAccount')}
              </Text>
              <TouchableOpacity
                onPress={() => dispatch({ type: 'SET_TAB', tab: isSignUp ? 'signIn' : 'signUp' })}
                accessibilityRole="button"
                accessibilityLabel={isSignUp ? t('auth.signInTab') : t('auth.signUpTab')}
              >
                <Text style={[typography('caption'), { color: colors.accent, fontWeight: 'bold' }]}>
                  {isSignUp ? t('auth.signInTab') : t('auth.signUpTab')}
                </Text>
              </TouchableOpacity>
            </View>

            {!isSignUp && (
              <TouchableOpacity
                onPress={handleForgotPassword}
                style={styles.forgotBtn}
                accessibilityRole="button"
                accessibilityLabel={t('auth.forgotPassword')}
              >
                <Text
                  style={[typography('caption'), { color: colors.textMuted, textAlign: 'center' }]}
                >
                  {t('auth.forgotPassword')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Social sign-in */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text
              style={[
                typography('caption'),
                { color: colors.textFaint, marginHorizontal: 12, letterSpacing: 1.5 },
              ]}
            >
              {'✦  ' + t('auth.orContinueWith') + '  ✦'}
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <Pressable
            onPress={() => void handleGoogleSignIn()}
            disabled={isLoading}
            testID="auth-google-btn"
            style={({ pressed }) => [
              styles.socialBtn,
              { borderColor: colors.border, backgroundColor: colors.surface },
              pressed && { opacity: 0.8 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('auth.google')}
          >
            <Text style={[styles.googleG, { color: '#4285F4' }]}>G</Text>
            <Text style={[typography('button'), { color: colors.text, marginLeft: 10 }]}>
              {t('auth.google')}
            </Text>
          </Pressable>

          {/* Terms notice */}
          <Text
            style={[
              typography('caption'),
              {
                color: colors.textFaint,
                textAlign: 'center',
                marginTop: 16,
                paddingHorizontal: 32,
              },
            ]}
          >
            {t('auth.termsNotice')}{' '}
            <Text
              style={{ color: colors.accent }}
              onPress={() =>
                void Linking.openURL('https://shams-app-4d0e7.web.app/privacy-policy.html')
              }
            >
              {t('auth.privacyLink')}
            </Text>
            {' & '}
            <Text
              style={{ color: colors.accent }}
              onPress={() => void Linking.openURL('https://shams-app-4d0e7.web.app/terms.html')}
            >
              {t('auth.termsLink')}
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

interface TabButtonProps {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  typography: ReturnType<typeof useTypography>;
  testID?: string;
}

const TabButton: React.FC<TabButtonProps> = ({
  label,
  active,
  onPress,
  colors,
  typography,
  testID,
}) => (
  <Pressable
    onPress={onPress}
    testID={testID}
    style={[
      styles.tabBtn,
      active && { borderBottomColor: colors.goldBright, borderBottomWidth: 2 },
    ]}
    accessibilityRole="tab"
    accessibilityState={{ selected: active }}
  >
    <Text
      style={[
        typography('label'),
        { color: active ? colors.goldBright : colors.textMuted, letterSpacing: 1.2 },
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

interface FieldProps {
  label: string;
  value: string;
  error: string;
  onChangeText: (v: string) => void;
  onSubmitEditing?: () => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'words' | 'sentences';
  autoComplete?: 'email' | 'current-password' | 'new-password' | 'name' | 'off';
  returnKeyType?: 'next' | 'done';
  rightLabel?: string;
  onRightPress?: () => void;
  colors: ReturnType<typeof useColors>;
  typography: ReturnType<typeof useTypography>;
  testID?: string;
}

const Field = React.forwardRef<TextInput, FieldProps>(
  (
    {
      label,
      value,
      error,
      onChangeText,
      onSubmitEditing,
      secureTextEntry = false,
      keyboardType = 'default',
      autoCapitalize = 'sentences',
      autoComplete = 'off',
      returnKeyType = 'next',
      rightLabel,
      onRightPress,
      colors,
      typography,
      testID,
    },
    ref,
  ) => (
    <View style={styles.fieldWrap}>
      <Text
        style={[
          typography('label'),
          {
            color: colors.goldBright,
            marginBottom: 6,
            letterSpacing: 1,
            fontSize: 10,
            opacity: 0.8,
          },
        ]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.inputRow,
          {
            borderColor: error ? colors.negative : colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <TextInput
          ref={ref}
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          returnKeyType={returnKeyType}
          style={[styles.input, typography('body'), { color: colors.text, flex: 1 }]}
          placeholderTextColor={colors.textFaint}
          underlineColorAndroid="transparent"
          blurOnSubmit={returnKeyType === 'done'}
          // The visible field label is a sibling <Text>, not programmatically
          // associated, so a screen reader would otherwise announce an unlabeled
          // edit box. Bind the label explicitly, and voice the inline error.
          accessibilityLabel={error.length > 0 ? `${label}. ${error}` : label}
        />
        {rightLabel !== undefined && (
          <Pressable
            onPress={onRightPress}
            style={styles.fieldRight}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={rightLabel}
          >
            <Text style={[typography('caption'), { color: colors.textMuted }]}>{rightLabel}</Text>
          </Pressable>
        )}
      </View>
      {error.length > 0 && (
        <Text style={[typography('caption'), { color: colors.negative, marginTop: 4 }]}>
          {error}
        </Text>
      )}
    </View>
  ),
);

/* -------------------------------------------------------------------------- */
/*  Error normalisation                                                       */
/* -------------------------------------------------------------------------- */

function normaliseAuthError(raw: string, t: ReturnType<typeof useTranslation>): string {
  // Firebase Auth embeds the error code in the message: [firebase_auth/code]
  const lower = raw.toLowerCase();

  // Sign-in failures
  if (
    lower.includes('wrong-password') ||
    lower.includes('user-not-found') ||
    lower.includes('invalid-credential') ||
    lower.includes('invalid-email') ||
    lower.includes('user-disabled')
  ) {
    return t('errors.signInFailed');
  }

  // Sign-up failures
  if (lower.includes('email-already-in-use') || lower.includes('operation-not-allowed')) {
    return t('errors.signUpFailed');
  }

  // Too many attempts — Firebase's own server-side throttle (our client
  // lockout is surfaced separately with a live countdown).
  if (lower.includes('too-many-requests')) {
    return t('errors.tooManyAttemptsWait');
  }

  // Network / connectivity
  if (
    lower.includes('network-request-failed') ||
    lower.includes('network') ||
    lower.includes('fetch')
  ) {
    return t('errors.network');
  }

  // Generic fallback — do NOT leak raw Firebase error detail to production UI
  if (!__DEV__) {
    return t('errors.unknown');
  }
  return raw;
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                    */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  brand: {
    marginBottom: 32,
    marginTop: 16,
    alignItems: 'center',
    position: 'relative',
  },
  brandGlow: {
    position: 'absolute',
    width: 200,
    height: 80,
    borderRadius: 40,
    opacity: 0.6,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 24,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 10,
  },
  form: {
    gap: 18,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  fieldWrap: {
    gap: 0,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  input: {
    paddingVertical: 12,
  },
  fieldRight: {
    paddingLeft: 8,
  },
  serverError: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
  },
  successBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  submitBtn: {
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  forgotBtn: {
    marginTop: 12,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  googleG: {
    fontSize: 22,
    fontWeight: '700',
  },
});

export default AuthScreen;
