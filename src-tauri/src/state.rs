use std::{path::PathBuf, sync::Arc};

use anyhow::Result;
use tauri::{path::BaseDirectory, App, Manager};
use tokio::sync::Mutex;

use crate::{
    message::{
        action::Actions,
        folder_manager::FolderManager,
        meta::Meta,
        settings::{read_settings_file, Settings},
    },
    window::PinnedWindowState,
};

#[derive(Clone)]
pub struct AppState {
    pub build_path: PathBuf,
    pub config_path: PathBuf,
    pub folder_manager: FolderManager,
    pub meta: Arc<Mutex<Option<Meta>>>,
    pub settings: Arc<Mutex<Settings>>,
    pub last_focused_app_name: Arc<Mutex<Option<String>>>,
    pub pinned_state_before_search: Arc<Mutex<PinnedWindowState>>,
    pub actions: Arc<Mutex<Option<Actions>>>,
}

impl AppState {
    pub fn new(app: &mut App) -> Result<Self> {
        let build_path = app.path().resolve("build", BaseDirectory::Resource)?;
        let config_path = app.path().resolve("", BaseDirectory::AppConfig)?;
        let folder_manager = FolderManager::new(app)?;
        let settings = Arc::new(Mutex::new(read_settings_file(&config_path)?));
        let meta = Arc::new(Mutex::new(None));
        let last_focused_app_name = Arc::new(Mutex::new(None));
        let pinned_state_before_search = Arc::new(Mutex::new(PinnedWindowState::Unfocused {
            visible: false,
            last_focused_app_name: None,
        }));
        let actions = Arc::new(Mutex::new(None));
        Ok(Self {
            build_path,
            config_path,
            folder_manager,
            settings,
            meta,
            last_focused_app_name,
            pinned_state_before_search,
            actions,
        })
    }
}
