use command::{get_commands, Command, CommandPaletteType, Locater};

use meta::{read_meta, write_meta};
use note::Note;
use note::{create_note, read_note, write_note};
use serde::{Deserialize, Serialize};
use settings::{write_settings, Settings};
use tauri::AppHandle;
use ts_rs::TS;

use crate::state::AppState;

use anyhow::Result;

pub mod command;
pub mod folder_manager;
pub mod meta;
pub mod note;
pub mod settings;

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
    CreateNote {
        title: String,
    },
    GetCommands {
        search: String,
        locater: Locater,
        command_palette_type: CommandPaletteType,
    },
    AddPinned {
        path: String,
        position: usize,
    },
    RemovePinned {
        path: String,
    },
    GetPinned,
}

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type")]
pub enum ServerMessage {
    Settings { settings: Settings },
    Note { note: Option<Note> },
    NotePath { path: String },
    None,
    Commands { commands: Vec<Command> },
    Pinned { pinned: Vec<String> },
    Error { error: String },
}

impl Default for Settings {
    fn default() -> Self {
        Self { notes_path: None }
    }
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
        CreateNote { title } => {
            let path = create_note(state, app, title).await?;
            Ok(ServerMessage::NotePath { path })
        }
        GetCommands {
            search,
            locater,
            command_palette_type,
        } => Ok(ServerMessage::Commands {
            commands: get_commands(state, app.clone(), search, locater, command_palette_type)
                .await?,
        }),
        GetPinned => Ok(ServerMessage::Pinned {
            pinned: read_meta(state, app, |meta| meta.pinned.clone()).await?,
        }),
        AddPinned { path, position } => {
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
