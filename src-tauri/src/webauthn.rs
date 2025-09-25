// src-tauri/src/webauthn.rs

use serde::{Deserialize, Serialize};
use tauri::command;
use rand::RngCore;
use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use std::time::Duration;

// Note: The objc2 bindings may not have all WebAuthn types available yet
// This is a framework implementation that can be extended when the APIs are stable
#[cfg(any(target_os = "macos", target_os = "ios"))]
use objc2_foundation::NSObject;

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

/// Generate a cryptographically secure random challenge for WebAuthn operations
///
/// Creates a 32-byte random challenge encoded as base64url (URL-safe base64).
/// This challenge prevents replay attacks and ensures each authentication
/// request is unique.
///
/// Mirrors the generateChallenge() function from webauthn.service.ts
fn generate_challenge() -> String {
    let mut array = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut array);
    URL_SAFE_NO_PAD.encode(array)
}

/// Get the appropriate editing domain for WebAuthn authentication
/// Uses localhost in development, configured domain in production
///
/// Mirrors the getEditingDomain() function from webauthn.service.ts
fn get_editing_domain() -> String {
    // In development, use localhost
    if cfg!(debug_assertions) {
        "localhost".to_string()
    } else {
        // Use configured editing domain for production
        "app.sparktype.org".to_string()
    }
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

/// Authenticate user for site access using native WebAuthn
#[command]
pub async fn authenticate_passkey(
    site_id: String,
    auth_config: SiteAuthConfig,
) -> Result<AuthenticationResult, String> {
    #[cfg(any(target_os = "macos", target_os = "ios"))]
    {
        let editing_domain = get_editing_domain();
        match authenticate_with_native_webauthn(&site_id, &auth_config, &editing_domain).await {
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

/// Register a new WebAuthn credential using native WebAuthn
#[command]
pub async fn register_passkey(
    site_id: String,
    site_name: String,
    user_display_name: Option<String>,
) -> Result<RegistrationResult, String> {
    #[cfg(any(target_os = "macos", target_os = "ios"))]
    {
        let editing_domain = get_editing_domain();
        match register_with_native_webauthn(&site_id, &site_name, &user_display_name, &editing_domain).await {
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
async fn authenticate_with_native_webauthn(
    site_id: &str,
    auth_config: &SiteAuthConfig,
    editing_domain: &str,
) -> Result<AuthenticationResult, String> {
    // Generate a fresh challenge for this authentication
    let challenge = generate_challenge();

    log::info!("Starting native WebAuthn authentication for site: {}", site_id);
    log::info!("Challenge: {}", challenge);
    log::info!("Editing domain: {}", editing_domain);
    log::info!("Credential ID: {}", auth_config.credential_id);

    // TODO: Implement actual ASAuthorizationController integration
    // This would involve:
    // 1. Creating ASAuthorizationPlatformPublicKeyCredentialProvider
    // 2. Setting up ASAuthorizationController with delegate
    // 3. Configuring presentation context
    // 4. Handling biometric authentication prompt
    // 5. Processing the authentication response

    // For now, simulate successful authentication in development
    if cfg!(debug_assertions) {
        log::warn!("Development mode: simulating successful authentication");

        // Use async sleep from tokio
        tokio::time::sleep(Duration::from_millis(1500)).await;

        return Ok(AuthenticationResult {
            success: true,
            error: None,
            credential_id: Some(auth_config.credential_id.clone()),
        });
    }

    // In production, return framework status
    Ok(AuthenticationResult {
        success: false,
        error: Some("Native WebAuthn authentication requires ASAuthorizationController integration".to_string()),
        credential_id: Some(auth_config.credential_id.clone()),
    })
}

#[cfg(any(target_os = "macos", target_os = "ios"))]
async fn register_with_native_webauthn(
    site_id: &str,
    site_name: &str,
    user_display_name: &Option<String>,
    editing_domain: &str,
) -> Result<RegistrationResult, String> {
    // Generate a random challenge for this registration
    let challenge = generate_challenge();

    log::info!("Starting native WebAuthn registration for site: {}", site_id);
    log::info!("Challenge: {}", challenge);
    log::info!("Site name: {}", site_name);
    log::info!("User display name: {:?}", user_display_name);
    log::info!("Editing domain: {}", editing_domain);

    // TODO: Implement actual ASAuthorizationController integration
    // This would involve:
    // 1. Creating ASAuthorizationPlatformPublicKeyCredentialProvider
    // 2. Setting up registration request with challenge
    // 3. Configuring ASAuthorizationController with delegate
    // 4. Handling biometric registration prompt
    // 5. Extracting public key and credential ID from response

    // Create a placeholder auth config with proper structure
    let auth_config = SiteAuthConfig {
        public_key: if cfg!(debug_assertions) {
            format!("dev_public_key_{}", challenge)
        } else {
            format!("placeholder_public_key_{}", challenge)
        },
        credential_id: if cfg!(debug_assertions) {
            format!("dev_credential_id_{}", site_id)
        } else {
            format!("placeholder_credential_id_{}", site_id)
        },
        requires_auth: true,
        user_display_name: user_display_name.clone(),
        registered_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
            .to_string(),
    };

    // In development mode, simulate successful registration
    if cfg!(debug_assertions) {
        log::warn!("Development mode: simulating successful registration");

        // Use async sleep from tokio
        tokio::time::sleep(Duration::from_millis(2000)).await;

        return Ok(RegistrationResult {
            success: true,
            auth_config: Some(auth_config),
            error: None,
        });
    }

    // In production, return framework status
    Ok(RegistrationResult {
        success: false,
        auth_config: Some(auth_config),
        error: Some("Native WebAuthn registration requires ASAuthorizationController integration".to_string()),
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