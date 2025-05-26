use std::{io::Write, path::PathBuf};

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::state::AppState;

use anyhow::Result;

#[derive(Serialize, Deserialize, TS, Clone)]
#[ts(export)]
pub struct Settings {
    pub notes_path: Option<String>,
}

pub fn read_settings_file(config_path: &PathBuf) -> Result<Settings> {
    let path = config_path.join("settings.json");

    if path.exists() {
        Ok(serde_json::from_str(&std::fs::read_to_string(path)?)?)
    } else {
        let mut file = std::fs::File::create(path)?;
        file.write_all(serde_json::to_string(&Settings::default())?.as_bytes())?;
        Ok(Settings::default())
    }
}

pub async fn write_settings(state: &AppState, settings: Settings) -> Result<()> {
    tokio::fs::write(
        state.config_path.join("settings.json"),
        serde_json::to_string(&settings).unwrap(),
    )
    .await?;
    (*state.settings.lock().await) = settings;
    Ok(())
}
