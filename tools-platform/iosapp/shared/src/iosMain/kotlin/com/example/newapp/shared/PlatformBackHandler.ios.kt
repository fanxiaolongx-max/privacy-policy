package com.example.newapp.shared

import androidx.compose.runtime.Composable

@Composable
actual fun PlatformBackHandler(enabled: Boolean, onBack: () -> Unit) {
    // iOS doesn't have a hardware back button. 
    // Back gestures are handled by UI components, so we do nothing here.
}
