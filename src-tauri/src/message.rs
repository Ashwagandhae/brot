use meta::{read_meta, write_meta};
use note::Note;
use note::{create_note, read_note, write_note};
use serde::{Deserialize, Serialize};
use settings::{write_settings, Settings};
use tauri::AppHandle;
use ts_rs::TS;

use crate::message::action::{read_actions, Actions, PartialActionFilter};
use crate::message::command::{get_palette_actions, PaletteAction};
use crate::message::note::update_path;
use crate::message::settings::read_settings_file;
use crate::state::AppState;

use anyhow::Result;

pub mod action;
pub mod command;
pub mod editor_state;
pub mod folder_manager;
pub mod locater;
pub mod meta;
pub mod note;
pub mod settings;
pub mod title;

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type")]
pub enum ClientMessage {
    RequestSettings,
    UpdateSettings {
        settings: Settings,
    },
    RequestNote {
        path: String,
    },
    UpdateNote {
        path: String,
        note: Note,
    },
    UpdatePath {
        current_path: String,
        new_title: String,
    },
    CreateNote {
        title: String,
    },
    GetPaletteActions {
        palette_key: String,
        search: String,
        filters: Vec<PartialActionFilter>,
    },
    AddPinned {
        path: String,
        position: usize,
    },
    RemovePinned {
        path: String,
    },
    GetPinned,
    GetActions,
    Refresh,
}

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type")]
pub enum ServerMessage {
    Settings { settings: Settings },
    Note { note: Option<Note> },
    NotePath { path: Option<String> },
    None,
    PaletteActions { actions: Vec<PaletteAction> },
    Actions { actions: Actions },
    Pinned { pinned: Vec<String> },
    Error { error: String },
}

pub async fn handle_message(
    message: ClientMessage,
    state: &AppState,
    app: Option<AppHandle>,
) -> Result<ServerMessage> {
    use ClientMessage::*;
    match message {
        RequestSettings => Ok(ServerMessage::Settings {
            settings: state.settings.lock().await.clone(),
        }),
        UpdateSettings { settings } => {
            write_settings(state, settings).await?;
            Ok(ServerMessage::None)
        }
        RequestNote { path } => Ok(ServerMessage::Note {
            note: read_note(state, app, &path).await?,
        }),
        UpdateNote { path, note } => {
            write_note(state, app, &path, note).await?;
            Ok(ServerMessage::None)
        }
        UpdatePath {
            current_path,
            new_title,
        } => Ok(ServerMessage::NotePath {
            path: update_path(state, app, current_path, new_title).await?,
        }),
        CreateNote { title } => {
            let path = create_note(state, app, title).await?;
            Ok(ServerMessage::NotePath { path })
        }
        GetPaletteActions {
            palette_key,
            search,
            filters,
        } => Ok(ServerMessage::PaletteActions {
            actions: get_palette_actions(state, &app, &palette_key, &search, filters).await?,
        }),
        GetPinned => Ok(ServerMessage::Pinned {
            pinned: read_meta(state, app, |meta| meta.pinned.clone()).await?,
        }),
        AddPinned { path, position } => {
            if read_meta(state, app.clone(), |meta| meta.pinned.contains(&path)).await? {
                return Ok(ServerMessage::None);
            }
            write_meta(state, app, |meta| {
                meta.pinned.insert(position, path.clone())
            })
            .await?;
            Ok(ServerMessage::None)
        }
        RemovePinned { path } => {
            write_meta(state, app, |meta| {
                meta.pinned.retain(|p| *p != path);
            })
            .await?;
            Ok(ServerMessage::None)
        }
        Refresh => {
            *state.meta.lock().await = None;
            let config_path = state.config_path.clone();
            *state.settings.lock().await =
                tokio::task::spawn_blocking(move || read_settings_file(&config_path)).await??;
            *state.actions.lock().await = None;

            Ok(ServerMessage::None)
        }
        GetActions => Ok(ServerMessage::Actions {
            actions: read_actions(state, app, |a| a.clone()).await?,
        }),
    }
}

pub async fn handle_message_and_errors(
    message: ClientMessage,
    state: &AppState,
    app: Option<AppHandle>,
) -> ServerMessage {
    let response = handle_message(message, state, app).await;

    match response {
        Ok(message) => message,
        Err(error) => {
            println!("server err: {}", error.to_string());
            ServerMessage::Error {
                error: error.to_string(),
            }
        }
    }
}
