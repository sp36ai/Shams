# ════════════════════════════════════════════════════════════════════
# Shams al-Asrār — ProGuard / R8 rules
# ════════════════════════════════════════════════════════════════════
# Security posture:
#   - R8 full mode (android.enableR8.fullMode=true in gradle.properties)
#   - All class/method/field names obfuscated EXCEPT the minimum surface
#     required for the React Native JNI bridge, Hermes, and 3rd-party
#     libraries that use reflection.
#   - All log calls stripped in release.
#   - mapping.txt produced by R8 — upload to Play Console, NEVER ship in APK.
# ════════════════════════════════════════════════════════════════════

# ── React Native core ────────────────────────────────────────────────
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep,allowobfuscation @interface com.facebook.common.internal.DoNotStrip
-keep @com.facebook.proguard.annotations.DoNotStrip class * { *; }
-keep @com.facebook.common.internal.DoNotStrip class * { *; }
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
    @com.facebook.common.internal.DoNotStrip *;
}
-keep public class com.facebook.react.ReactActivity { *; }
-keep public class com.facebook.react.ReactApplication { *; }
-keep public class com.facebook.react.bridge.** { *; }
-keep public class com.facebook.react.modules.core.** { *; }
-keep public class com.facebook.react.uimanager.** { *; }
-keep public class com.facebook.react.uimanager.ViewManager { *; }
-keep public class com.facebook.react.uimanager.ReactShadowNode { *; }
-keep class * extends com.facebook.react.uimanager.ViewManager { *; }
-keep class * extends com.facebook.react.uimanager.ReactShadowNode { *; }
-keep class * implements com.facebook.react.uimanager.ViewManagerPropertyUpdater$ViewManagerSetter { *; }
-keep class * implements com.facebook.react.uimanager.ViewManagerPropertyUpdater$ShadowNodeSetter { *; }

-keep public class com.facebook.hermes.** { *; }
-keep public class com.facebook.jni.** { *; }

# Keep the app's own Activity/Application (Android entry points)
-keep public class com.astrosarfaraz.shamsalasrar.MainActivity { *; }
-keep public class com.astrosarfaraz.shamsalasrar.MainApplication { *; }

# ── Hermes ──────────────────────────────────────────────────────────
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# ── Reanimated 3 ─────────────────────────────────────────────────────
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keepclassmembers class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.reanimated.nativeProxy.** { *; }

# ── Firebase / Google Services ──────────────────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ── Gesture Handler ─────────────────────────────────────────────────
-keep class com.swmansion.gesturehandler.** { *; }

# ── MMKV ────────────────────────────────────────────────────────────
-keep class com.tencent.mmkv.** { *; }
-keep class com.tencent.mmkv.MMKV { *; }

# ── react-native-svg ────────────────────────────────────────────────
-keep class com.horcrux.svg.** { *; }

# ── Safe Area Context ────────────────────────────────────────────────
-keep class com.th3rdwave.safeareacontext.** { *; }

# ── React Navigation native deps ─────────────────────────────────────
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.reactnativegooglesignin.** { *; }

# ── Google Sign-In / GMS Auth ────────────────────────────────────────
-keep class com.google.android.gms.auth.** { *; }
-keep class com.google.android.gms.common.** { *; }
-dontwarn com.google.android.gms.auth.**

# ── react-native-iap / Google Play Billing ───────────────────────────
-keep class com.dooboolab.rniap.** { *; }
-keep class com.android.vending.billing.** { *; }
-keep interface com.android.vending.billing.** { *; }
-dontwarn com.dooboolab.rniap.**

# ── React Native Firebase bridge ─────────────────────────────────────
-keep class io.invertase.firebase.** { *; }

# ── OkHttp / Kotlin ─────────────────────────────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-keep class kotlin.** { *; }
-keep class kotlin.Metadata { *; }
-keepclassmembers class kotlin.coroutines.** { volatile <fields>; }
-keepclassmembers class kotlinx.coroutines.** { volatile <fields>; }
-keep class kotlinx.serialization.** { *; }

# ── Annotation retention ─────────────────────────────────────────────
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes EnclosingMethod
-keepattributes InnerClasses
-keepattributes SourceFile,LineNumberTable

# ── Enum safety ─────────────────────────────────────────────────────
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ── Serializable ────────────────────────────────────────────────────
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ── Strip ALL log calls in release ─────────────────────────────────
# No debug strings, tag names, or diagnostic messages in the release APK.
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
    public static int i(...);
    public static int w(...);
    public static int e(...);
    public static int wtf(...);
}

# ── Force DEBUG=false at compile time ────────────────────────────────
-assumevalues class com.astrosarfaraz.shamsalasrar.BuildConfig {
    public static final boolean DEBUG return false;
}

# ── Native methods ───────────────────────────────────────────────────
-keepclasseswithmembernames class * {
    native <methods>;
}

# ── JavaScript interface bridges ─────────────────────────────────────
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ── Mapping output (upload to Play Console, never ship in APK) ──────
-printmapping mapping.txt
-renamesourcefileattribute SourceFile

# ── Suppress warnings for unused optional deps ──────────────────────
-dontwarn org.mozilla.javascript.**
-dontwarn org.apache.xmlcommons.**
-dontwarn sun.misc.Unsafe
