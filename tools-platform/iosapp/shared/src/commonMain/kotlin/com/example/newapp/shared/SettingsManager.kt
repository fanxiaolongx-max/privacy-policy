package com.example.newapp.shared

expect class SettingsManager() {
    fun saveString(key: String, value: String)
    fun getString(key: String, defaultValue: String): String
    fun saveBoolean(key: String, value: Boolean)
    fun getBoolean(key: String, defaultValue: Boolean): Boolean
    fun getCurrentMonth(): Int
    fun getAppVersion(): String
}
