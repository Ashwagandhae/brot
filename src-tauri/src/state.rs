use std::{path::PathBuf, sync::Arc};

use anyhow::Result;
use tauri::{path::BaseDirectory, App, Manager};
use tokio::sync::Mutex;

use crate::message::{
    folder_manager::FolderManager,
    meta::Meta,
    settings::{read_settings_file, Settings},
};

#[derive(Clone)]
pub struct AppState {
    pub build_path: PathBuf,
    pub config_path: PathBuf,
    pub folder_manager: FolderManager,
    pub meta: Arc<Mutex<Option<Meta>>>,
    pub settings: Arc<Mutex<Settings>>,
}

impl AppState {
    pub fn new(app: &mut App) -> Result<Self> {
        let build_path = app.path().resolve("build", BaseDirectory::Resource)?;
        let config_path = app.path().resolve("", BaseDirectory::AppConfig)?;
        let folder_manager = FolderManager::new(app)?;
        let settings = Arc::new(Mutex::new(read_settings_file(&config_path)?));
        let meta = Arc::new(Mutex::new(None));
        Ok(Self {
            build_path,
            config_path,
            folder_manager,
            settings,
            meta,
        })
    }
}
