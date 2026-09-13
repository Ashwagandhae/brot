use std::{path::PathBuf, sync::Arc};

use anyhow::{Context, Result};
use tauri::{App, AppHandle, Manager, path::BaseDirectory};
use tokio::sync::{Mutex, RwLock};

use crate::{
    message::{
        file_manager::FileManager,
        palette_action::PaletteAction,
        searcher::SearcherManager,
        settings::{Settings, read_settings_file},
        suggester::Suggestion,
    },
    missed_events::EventManager,
    previewer::Previewer,
};

#[derive(Debug, Clone)]
pub enum PinnedWindowState {
    Focused,
    Unfocused {
        visible: bool,
        last_focused_app_name: Option<String>,
    },
}

pub struct AppState {
    pub build_path: PathBuf,
    pub config_path: PathBuf,
    pub file_manager: FileManager,
    pub settings: Arc<Mutex<Settings>>,
    pub last_focused_app_name: Arc<Mutex<Option<String>>>,
    pub pinned_state_before_search: Arc<Mutex<PinnedWindowState>>,
    pub palettes: Arc<RwLock<SearcherManager<PaletteAction>>>,
    pub suggesters: Arc<RwLock<SearcherManager<Suggestion>>>,
    pub handle: AppHandle,
    pub event_manager: Arc<Mutex<EventManager>>,
    pub previewer: Arc<Mutex<Previewer>>,
}

impl AppState {
    pub fn new(app: &mut App) -> Result<Self> {
        let build_path = app.path().resolve("build", BaseDirectory::Resource)?;
        let config_path = app.path().resolve("", BaseDirectory::AppConfig)?;
        let settings = read_settings_file(&config_path)?;
        let file_manager = FileManager::new(
            app.handle().clone(),
            &settings.notes_path.clone().context("no notes path")?.into(),
        )?;
        let settings = Arc::new(Mutex::new(settings));
        let last_focused_app_name = Arc::new(Mutex::new(None));
        let pinned_state_before_search = Arc::new(Mutex::new(PinnedWindowState::Unfocused {
            visible: false,
            last_focused_app_name: None,
        }));
        let palettes = Arc::new(RwLock::new(SearcherManager::<PaletteAction>::new(
            |action| action.title.clone(),
        )));
        let suggesters = Arc::new(RwLock::new(SearcherManager::<Suggestion>::new(
            |suggestion| suggestion.value.clone(),
        )));
        let handle = app.handle().clone();
        let event_manager = Arc::new(Mutex::new(EventManager::new(app.handle().clone())));
        let previewer = Arc::new(Mutex::new(Previewer::new()));
        let state = Self {
            build_path,
            config_path,
            settings,
            file_manager,
            last_focused_app_name,
            pinned_state_before_search,
            palettes,
            suggesters,
            handle,
            event_manager,
            previewer,
        };
        Ok(state)
    }
}
