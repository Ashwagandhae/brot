use std::path::PathBuf;

use anyhow::anyhow;
use anyhow::Result;
use tauri::App;
use tauri::AppHandle;
use tauri_plugin_android_fs::{AndroidFsExt, FileUri, PersistableAccessMode, PrivateDir};
use tokio::fs;

use crate::state::AppState;

#[allow(unused)]
fn downloads_subfolder_uri(app: &mut App) -> Result<FileUri> {
    let api = app.android_fs();

    // Create a unique key for storing the URI
    let storage_key = format!("subfolder_uri");

    // Try to read the stored URI
    let stored_uri = api
        .private_storage()
        .read_to_string(PrivateDir::Data, &storage_key)
        .ok()
        .and_then(|s| FileUri::from_str(&s).ok());

    // Check if we still have permission
    if let Some(uri) = stored_uri {
        if api.check_persisted_uri_permission(&uri, PersistableAccessMode::ReadAndWrite)? {
            return Ok(uri);
        }
    }

    // Ask the user to pick the subfolder
    let selected_uri = api.show_manage_dir_dialog(None)?;

    let Some(uri) = selected_uri else {
        return Err(anyhow!("User cancelled folder selection"));
    };

    // Persist permission
    api.take_persistable_uri_permission(&uri)?;

    // Store the URI for future use
    api.private_storage()
        .write(PrivateDir::Data, &storage_key, uri.to_string()?.as_bytes())?;

    Ok(uri)
}

#[derive(Debug, Clone)]
pub enum FolderManager {
    Android { uri: FileUri },
    Normal,
}

impl FolderManager {
    #[allow(unused)]
    pub fn new(app: &mut App) -> Result<Self> {
        #[cfg(not(target_os = "android"))]
        {
            Ok(Self::Normal)
        }

        #[cfg(target_os = "android")]
        {
            Ok(Self::Android {
                uri: downloads_subfolder_uri(app)?,
            })
        }
    }
}

pub async fn read_file(
    state: &AppState,
    app: Option<AppHandle>,
    path: &str,
) -> Result<Option<String>> {
    match state.folder_manager {
        FolderManager::Normal => {
            let Some(path) = get_folder_path(state, path).await else {
                return Ok(None);
            };
            match fs::read_to_string(path).await {
                Ok(contents) => Ok(Some(contents)),
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
                Err(e) => Err(e.into()),
            }
        }
        FolderManager::Android { ref uri } => {
            let uri = uri.clone();
            let path = path.to_owned();
            tokio::task::spawn_blocking(move || {
                let app = app.unwrap();
                let api = app.android_fs();
                match api.resolve_uri(&uri, &path) {
                    Ok(file_uri) => Ok(Some(api.read_to_string(&file_uri)?)),
                    Err(tauri_plugin_android_fs::Error::Io(e))
                        if e.kind() == std::io::ErrorKind::NotFound =>
                    {
                        Ok(None)
                    }
                    Err(e) => Err(e.into()),
                }
            })
            .await?
        }
    }
}

pub async fn write_file(
    state: &AppState,
    app: Option<AppHandle>,
    path: &str,
    contents: String,
) -> Result<()> {
    match state.folder_manager {
        FolderManager::Normal => {
            let Some(path) = get_folder_path(state, path).await else {
                return Ok(());
            };
            fs::write(PathBuf::from(&path), contents).await?;
            Ok(())
        }
        FolderManager::Android { ref uri } => {
            let uri = uri.clone();
            let path = path.to_owned();
            tokio::task::spawn_blocking(move || {
                let app = app.unwrap();
                let api = app.android_fs();
                let file_uri = api.resolve_uri(&uri, path)?;
                api.write(&file_uri, contents.as_bytes())?;
                Ok(())
            })
            .await?
        }
    }
}

pub async fn file_exists(state: &AppState, app: Option<AppHandle>, path: &str) -> Result<bool> {
    match state.folder_manager {
        FolderManager::Normal => Ok(fs::try_exists(path).await?),
        FolderManager::Android { ref uri } => {
            let uri = uri.clone();
            let path = path.to_owned();
            tokio::task::spawn_blocking(move || {
                let app = app.unwrap();
                let api = app.android_fs();
                match api.resolve_uri(&uri, &path) {
                    Ok(_) => Ok(true),
                    Err(tauri_plugin_android_fs::Error::Io(e))
                        if e.kind() == std::io::ErrorKind::NotFound =>
                    {
                        Ok(false)
                    }
                    Err(e) => Err(e.into()),
                }
            })
            .await?
        }
    }
}

async fn get_folder_path(state: &AppState, path: &str) -> Option<PathBuf> {
    Some(PathBuf::from(state.settings.lock().await.notes_path.clone()?).join(path))
}
