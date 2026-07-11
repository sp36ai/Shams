package com.astrosarfaraz.shamsalasrar

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {

    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> =
                PackageList(this).packages.apply {
                    // Manually-linked packages can be added here.
                    // Phase 1 has none — all are autolinked.
                }

            override fun getJSMainModuleName(): String = "index"

            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
            override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
        }

    override val reactHost: ReactHost
        get() = getDefaultReactHost(applicationContext, reactNativeHost)

    override fun onCreate() {
        super.onCreate()
        // RN 0.78 splits several small JNI libs (react_featureflagsjni, uimanagerjni,
        // yoga, etc.) and merges them into libreactnative.so at build time ("SoMerging").
        // Without this mapping, SoLoader tries to dlopen the standalone .so files that
        // no longer exist and crashes on startup with UnsatisfiedLinkError.
        SoLoader.init(this, OpenSourceMergedSoMapping)

        // Certificate pinning is enforced at the platform level via network_security_config.xml
        // (with expiration 2027-05-01). OkHttp-level pinning was removed because it has no
        // expiration mechanism and would permanently brick the app if Google rotates certs.

        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            // If you opted-in for the New Architecture, we load the native entry point for this app.
            load()
        }
    }
}
