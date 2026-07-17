package com.example.newapp.shared

import androidx.compose.runtime.Composable
import androidx.activity.compose.BackHandler

@Composable
actual fun PlatformBackHandler(enabled: Boolean, onBack: () -> Unit) {
    BackHandler(enabled = enabled, onBack = onBack)
}
