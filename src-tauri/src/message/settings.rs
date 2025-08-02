use std::{
    collections::{HashMap, HashSet},
    io::Write,
    path::PathBuf,
};

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{message::locater::Locater, state::AppState, window_state::WindowState};

use anyhow::Result;

#[derive(Serialize, Deserialize, TS, Clone)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub notes_path: Option<String>,
    pub window_states: HashMap<Locater, WindowState>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub minimized_pinned_paths: Option<HashSet<String>>,
}

pub fn read_settings_file(config_path: &PathBuf) -> Result<Settings> {
    let path = config_path.join("settings.json");

    if path.exists() {
        Ok(serde_json::from_str(&std::fs::read_to_string(path)?)?)
    } else {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut file = std::fs::File::create(path)?;
        file.write_all(serde_json::to_string(&Settings::default())?.as_bytes())?;
        Ok(Settings::default())
    }
}

pub async fn write_settings(state: &AppState, settings: Settings) -> Result<()> {
    println!("writing settings");
    tokio::fs::write(
        state.config_path.join("settings.json"),
        serde_json::to_string(&settings).unwrap(),
    )
    .await?;
    (*state.settings.lock().await) = settings;
    Ok(())
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            notes_path: None,
            window_states: HashMap::new(),
            minimized_pinned_paths: None,
        }
    }
}
