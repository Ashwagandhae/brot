use std::path::PathBuf;

use anyhow::anyhow;
use anyhow::Result;
use tauri::App;
use tauri_plugin_android_fs::Entry;
use tauri_plugin_android_fs::{AndroidFsExt, FileUri, PersistableAccessMode, PrivateDir};
use tokio::fs;

use crate::state::AppState;

#[allow(unused)]
fn downloads_subfolder_uri(app: &mut App) -> Result<FileUri> {
    let api = app.android_fs();

    let storage_key = format!("subfolder_uri");

    let stored_uri = api
        .private_storage()
        .read_to_string(PrivateDir::Data, &storage_key)
        .ok()
        .and_then(|s| FileUri::from_str(&s).ok());

    if let Some(uri) = stored_uri {
        if api.check_persisted_uri_permission(&uri, PersistableAccessMode::ReadAndWrite)? {
            return Ok(uri);
        }
    }

    let selected_uri = api.show_manage_dir_dialog(None)?;

    let Some(uri) = selected_uri else {
        return Err(anyhow!("User cancelled folder selection"));
    };

    api.take_persistable_uri_permission(&uri)?;

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

pub async fn read(state: &AppState, path: &str) -> Result<Option<String>> {
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
            if !file_exists(state, path).await? {
                return Ok(None);
            }
            let uri = uri.clone();
            let app = state.handle.clone();
            let path = path.to_owned();
            tokio::task::spawn_blocking(move || {
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

pub async fn write(state: &AppState, path: &str, contents: String) -> Result<()> {
    match state.folder_manager {
        FolderManager::Normal => {
            let Some(path) = get_folder_path(state, path).await else {
                return Ok(());
            };
            fs::write(PathBuf::from(&path), contents).await?;
            Ok(())
        }
        FolderManager::Android { ref uri } => {
            if !file_exists(state, path).await? {
                let uri = uri.clone();
                let path = path.to_owned();
                let app = state.handle.clone();
                tokio::task::spawn_blocking(move || -> Result<()> {
                    let api = app.android_fs();
                    api.create_file(&uri, path, None)?;
                    Ok(())
                })
                .await??;
            }
            let uri = uri.clone();
            let path = path.to_owned();
            let app = state.handle.clone();
            tokio::task::spawn_blocking(move || {
                let api = app.android_fs();
                let file_uri = api.resolve_uri(&uri, path)?;
                api.write(&file_uri, contents.as_bytes())?;
                Ok(())
            })
            .await?
        }
    }
}

pub async fn remove_file(state: &AppState, path: &str) -> Result<()> {
    match state.folder_manager {
        FolderManager::Normal => {
            let Some(path) = get_folder_path(state, path).await else {
                return Ok(());
            };
            fs::remove_file(path).await?;
            Ok(())
        }
        FolderManager::Android { ref uri } => {
            let uri = uri.clone();
            let path = path.to_owned();
            let app = state.handle.clone();
            tokio::task::spawn_blocking(move || {
                let api = app.android_fs();
                let file_uri = api.resolve_uri(&uri, path)?;
                api.remove_file(&file_uri)?;
                Ok(())
            })
            .await?
        }
    }
}

pub async fn file_exists(state: &AppState, path: &str) -> Result<bool> {
    match state.folder_manager {
        FolderManager::Normal => {
            let Some(path) = get_folder_path(state, path).await else {
                return Ok(false);
            };
            Ok(fs::try_exists(path).await?)
        }
        FolderManager::Android { ref uri } => {
            let uri = uri.clone();
            let path = path.to_owned();
            let app = state.handle.clone();
            tokio::task::spawn_blocking(move || {
                let api = app.android_fs();
                match api.resolve_uri(&uri, &path) {
                    Ok(uri) => match api.get_mime_type(&uri) {
                        Ok(Some(_)) => Ok(true),
                        Ok(None) => Ok(false),
                        Err(tauri_plugin_android_fs::Error::Io(e))
                            if e.kind() == std::io::ErrorKind::NotFound =>
                        {
                            Ok(false)
                        }
                        // TODO find better solution for this
                        Err(tauri_plugin_android_fs::Error::PluginInvoke(message))
                            if message.contains("java.io.FileNotFoundException") =>
                        {
                            Ok(false)
                        }

                        Err(err) => Err(err.into()),
                    },
                    Err(err) => Err(err.into()),
                }
            })
            .await?
        }
    }
}

async fn get_folder_path(state: &AppState, path: &str) -> Option<PathBuf> {
    Some(PathBuf::from(state.settings.lock().await.notes_path.clone()?).join(path))
}

pub async fn read_dir(state: &AppState) -> Result<Vec<String>> {
    match state.folder_manager {
        FolderManager::Normal => {
            let Some(path) = get_folder_path(state, "").await else {
                return Ok(Vec::new());
            };
            let mut entries = fs::read_dir(&path).await?;
            let mut paths = Vec::new();
            while let Some(entry) = entries.next_entry().await? {
                paths.push(
                    entry
                        .file_name()
                        .into_string()
                        .expect("invalid entry string"),
                );
            }
            Ok(paths)
        }
        FolderManager::Android { ref uri } => {
            let uri = uri.clone();
            let app = state.handle.clone();
            tokio::task::spawn_blocking(move || {
                let api = app.android_fs();
                Ok(api
                    .read_dir(&uri)?
                    .map(|entry| match entry {
                        Entry::File { name, .. } => name,
                        Entry::Dir { name, .. } => name,
                    })
                    .collect())
            })
            .await?
        }
    }
}
