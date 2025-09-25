// src-tauri/src/webauthn.rs

use serde::{Deserialize, Serialize};
use tauri::command;

#[cfg(target_os = "macos")]
use cocoa::appkit::NSApplication;
#[cfg(target_os = "macos")]
use cocoa::base::{id, nil};
#[cfg(target_os = "macos")]
use cocoa::foundation::{NSString, NSAutoreleasePool};
#[cfg(target_os = "macos")]
use objc::runtime::Class;
#[cfg(target_os = "macos")]
use objc::{msg_send, sel, sel_impl};

/// Configuration for site-specific WebAuthn authentication
/// Matches the structure in webauthn.service.ts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SiteAuthConfig {
    #[serde(rename = "publicKey")]
    pub public_key: String,
    #[serde(rename = "credentialId")]
    pub credential_id: String,
    #[serde(rename = "requiresAuth")]
    pub requires_auth: bool,
    #[serde(rename = "userDisplayName")]
    pub user_display_name: Option<String>,
    #[serde(rename = "registeredAt")]
    pub registered_at: String,
}

/// Result of a WebAuthn authentication attempt
#[derive(Debug, Serialize)]
pub struct AuthenticationResult {
    pub success: bool,
    pub error: Option<String>,
    #[serde(rename = "credentialId")]
    pub credential_id: Option<String>,
}

/// Result of WebAuthn credential registration
#[derive(Debug, Serialize)]
pub struct RegistrationResult {
    pub success: bool,
    #[serde(rename = "authConfig")]
    pub auth_config: Option<SiteAuthConfig>,
    pub error: Option<String>,
}

/// Check if WebAuthn is available on the current platform
#[command]
pub async fn is_webauthn_available() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        Ok(true) // ASWebAuthenticationSession is available on macOS 10.15+
    }
    #[cfg(target_os = "ios")]
    {
        Ok(true) // ASWebAuthenticationSession is available on iOS 12+
    }
    #[cfg(not(any(target_os = "macos", target_os = "ios")))]
    {
        Ok(false)
    }
}

/// Authenticate user for site access using ASWebAuthenticationSession
#[command]
pub async fn authenticate_passkey(
    site_id: String,
    auth_config: SiteAuthConfig,
    editing_domain: String,
) -> Result<AuthenticationResult, String> {
    #[cfg(any(target_os = "macos", target_os = "ios"))]
    {
        match authenticate_with_aswebauth(&site_id, &auth_config, &editing_domain).await {
            Ok(result) => Ok(result),
            Err(error) => Ok(AuthenticationResult {
                success: false,
                error: Some(error),
                credential_id: None,
            }),
        }
    }
    #[cfg(not(any(target_os = "macos", target_os = "ios")))]
    {
        Ok(AuthenticationResult {
            success: false,
            error: Some("WebAuthn not supported on this platform".to_string()),
            credential_id: None,
        })
    }
}

/// Register a new WebAuthn credential using ASWebAuthenticationSession
#[command]
pub async fn register_passkey(
    site_id: String,
    site_name: String,
    user_display_name: Option<String>,
    editing_domain: String,
) -> Result<RegistrationResult, String> {
    #[cfg(any(target_os = "macos", target_os = "ios"))]
    {
        match register_with_aswebauth(&site_id, &site_name, &user_display_name, &editing_domain).await {
            Ok(result) => Ok(result),
            Err(error) => Ok(RegistrationResult {
                success: false,
                auth_config: None,
                error: Some(error),
            }),
        }
    }
    #[cfg(not(any(target_os = "macos", target_os = "ios")))]
    {
        Ok(RegistrationResult {
            success: false,
            auth_config: None,
            error: Some("WebAuthn not supported on this platform".to_string()),
        })
    }
}

#[cfg(any(target_os = "macos", target_os = "ios"))]
async fn authenticate_with_aswebauth(
    site_id: &str,
    auth_config: &SiteAuthConfig,
    editing_domain: &str,
) -> Result<AuthenticationResult, String> {
    use std::ffi::CString;
    use std::ptr;

    // For now, we'll create a basic implementation that uses ASWebAuthenticationSession
    // to authenticate against the WebAuthn endpoints

    // Construct the authentication URL
    let auth_url = format!(
        "https://{}/webauthn/authenticate?siteId={}&credentialId={}",
        editing_domain,
        site_id,
        auth_config.credential_id
    );

    // Use ASWebAuthenticationSession to perform the authentication
    // This is a simplified implementation - in a real scenario, you'd want to:
    // 1. Present the ASWebAuthenticationSession
    // 2. Handle the callback with authentication result
    // 3. Parse the WebAuthn response

    // For now, we'll return a placeholder result
    // TODO: Implement actual ASWebAuthenticationSession integration

    log::info!("Authenticating with URL: {}", auth_url);

    Ok(AuthenticationResult {
        success: false,
        error: Some("ASWebAuthenticationSession integration not yet implemented".to_string()),
        credential_id: None,
    })
}

#[cfg(any(target_os = "macos", target_os = "ios"))]
async fn register_with_aswebauth(
    site_id: &str,
    site_name: &str,
    user_display_name: &Option<String>,
    editing_domain: &str,
) -> Result<RegistrationResult, String> {
    // Construct the registration URL
    let registration_url = format!(
        "https://{}/webauthn/register?siteId={}&siteName={}",
        editing_domain,
        site_id,
        urlencoding::encode(site_name)
    );

    // Use ASWebAuthenticationSession to perform the registration
    // This is a simplified implementation - in a real scenario, you'd want to:
    // 1. Present the ASWebAuthenticationSession
    // 2. Handle the callback with registration result
    // 3. Parse the WebAuthn response and create SiteAuthConfig

    log::info!("Registering with URL: {}", registration_url);

    Ok(RegistrationResult {
        success: false,
        auth_config: None,
        error: Some("ASWebAuthenticationSession integration not yet implemented".to_string()),
    })
}

/// Initialize the WebAuthn plugin
pub fn init<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("webauthn")
        .invoke_handler(tauri::generate_handler![
            is_webauthn_available,
            authenticate_passkey,
            register_passkey
        ])
        .build()
}