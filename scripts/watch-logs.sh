#!/bin/bash
# Shams al-Asrār - Automatic Log Monitor
echo "--- Clearing old logs ---"
adb logcat -c
echo "--- Watching for [Shams] events ---"
echo "Tip: Launch the app on your device now."
adb logcat *:S ReactNativeJS:V | grep --line-buffered Shams