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
import com.facebook.react.modules.network.OkHttpClientProvider
import okhttp3.CertificatePinner
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
        SoLoader.init(this, /* native exopackage */ false)

        // Security Hardening: Certificate Pinning (captured 2026-05-07)
        val certificatePinner = CertificatePinner.Builder()
            .add("firestore.googleapis.com", "sha256/NHasLBXL7uS5JzodPAdAqd/YoGIy3AySHd7yyKRg5xo=")
            .add("firebase.googleapis.com", "sha256/oVK9AMvzuTJhavj8JKMULZqcgPvnTenud/VH/97y/XY=")
            .add("identitytoolkit.googleapis.com", "sha256/NHasLBXL7uS5JzodPAdAqd/YoGIy3AySHd7yyKRg5xo=")
            .build()

        OkHttpClientProvider.setOkHttpClientFactory {
            OkHttpClientProvider.createClientBuilder().certificatePinner(certificatePinner).build()
        }

        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            // If you opted-in for the New Architecture, we load the native entry point for this app.
            load()
        }
    }
}
