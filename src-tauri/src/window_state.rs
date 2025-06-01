use serde::{Deserialize, Serialize};
use tauri::State;
use ts_rs::TS;

use crate::{message::locater::Locater, state::AppState};

#[derive(Serialize, Deserialize, TS, Clone, PartialEq, Eq)]
pub struct WindowState {
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub floating: bool,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            width: 600,
            height: 1200,
            x: 0,
            y: 0,
            floating: false,
        }
    }
}

#[tauri::command]
pub async fn update_window_state(
    state: State<'_, AppState>,
    window: tauri::Window,
    locater: Locater,
) -> tauri::Result<()> {
    let mut settings = state.settings.lock().await;
    let inner_size = window.inner_size()?;
    let outer_position = window.outer_position()?;
    let window_state = WindowState {
        width: inner_size.width,
        height: inner_size.height,
        x: outer_position.x,
        y: outer_position.y,
        floating: window.is_always_on_top()?,
    };

    if settings
        .window_states
        .get(&locater)
        .map_or(true, |existing| existing != &window_state)
    {
        settings.window_states.insert(locater, window_state);

        tokio::fs::write(
            state.config_path.join("settings.json"),
            serde_json::to_string(&*settings).unwrap(),
        )
        .await?;
    }

    Ok(())
}
