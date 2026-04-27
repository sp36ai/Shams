package com.astrosarfaraz.shamsalasrar

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

    /**
     * Returns the name of the main component registered from JavaScript.
     * MUST match AppRegistry.registerComponent(...) name in index.js.
     */
    override fun getMainComponentName(): String = "ShamsAlAsrar"

    /**
     * Pass null Bundle to MainActivity#onCreate to fix
     * https://github.com/software-mansion/react-native-screens/issues/17
     */
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(null)
        // After splash window background is shown, swap to the real app theme
        setTheme(R.style.AppTheme)
    }

    /**
     * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
     * which allows you to enable New Architecture with a single boolean flag [fabricEnabled].
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
