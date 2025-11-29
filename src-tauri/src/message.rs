use std::collections::HashMap;

use meta::{read_meta, write_meta};
use note::Note;
use note::{create_note, read_note, write_note};
use serde::{Deserialize, Serialize};
use settings::{write_settings, Settings};
use ts_rs::TS;

use crate::message::action::{read_actions, Actions, PartialActionFilter};
use crate::message::meta::TagConfig;
use crate::message::note::update_path;
use crate::message::palette::{create_palette, delete_palette, search_palette};
use crate::message::palette_action::{Matched, PaletteAction};
use crate::message::searcher::SearcherId;
use crate::message::settings::read_settings_file;
use crate::message::suggester::{
    create_suggester, delete_suggester, search_suggester, SuggesterSource, Suggestion,
};
use crate::state::AppState;

use anyhow::Result;

pub mod action;
pub mod folder_manager;
pub mod locater;
pub mod meta;
pub mod note;
pub mod palette;
pub mod palette_action;
pub mod searcher;
pub mod settings;
pub mod suggester;
pub mod tag;
pub mod title;

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type", content = "data", rename_all = "camelCase")]
pub enum ClientMessage {
    GetSettings,
    #[serde(rename_all = "camelCase")]
    UpdateSettings {
        settings: Settings,
    },
    #[serde(rename_all = "camelCase")]
    GetNote {
        path: String,
    },
    #[serde(rename_all = "camelCase")]
    UpdateNote {
        path: String,
        note: Note,
    },
    #[serde(rename_all = "camelCase")]
    UpdatePath {
        current_path: String,
        new_title: String,
    },
    #[serde(rename_all = "camelCase")]
    CreateNote {
        title: String,
    },
    #[serde(rename_all = "camelCase")]
    CreatePalette {
        palette_key: String,
        filters: Vec<PartialActionFilter>,
    },
    #[serde(rename_all = "camelCase")]
    DeletePalette {
        id: SearcherId,
    },
    #[serde(rename_all = "camelCase")]
    CreateSuggester {
        suggester_source: SuggesterSource,
    },
    #[serde(rename_all = "camelCase")]
    SearchSuggester {
        id: SearcherId,
        search: String,
    },
    #[serde(rename_all = "camelCase")]
    DeleteSuggester {
        id: SearcherId,
    },
    #[serde(rename_all = "camelCase")]
    SearchPalette {
        id: SearcherId,
        search: String,
        start: u32,
        end: u32,
    },
    #[serde(rename_all = "camelCase")]
    AddPinned {
        path: String,
        position: usize,
    },
    #[serde(rename_all = "camelCase")]
    RemovePinned {
        path: String,
    },
    GetPinned,
    GetActions,
    GetTagConfigs,
    Refresh,
}

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type", content = "data", rename_all = "camelCase")]
/// ServerMessage's enum variant names must match ClientMessage's enum variant names
pub enum ServerMessage {
    GetSettings(Settings),
    UpdateSettings,
    GetNote(Option<Note>),
    UpdateNote,
    UpdatePath(Option<String>),
    CreateNote(Option<String>),
    Note(Option<Note>),
    CreatePalette(SearcherId),
    SearchPalette(Option<Vec<Matched<PaletteAction>>>),
    DeletePalette,
    CreateSuggester(SearcherId),
    SearchSuggester(Option<Vec<Matched<Suggestion>>>),
    DeleteSuggester,
    AddPinned,
    RemovePinned,
    GetPinned(Vec<String>),
    GetActions(Actions),
    GetTagConfigs(HashMap<String, TagConfig>),
    Refresh,
}

pub async fn handle_message(message: ClientMessage, state: &AppState) -> Result<ServerMessage> {
    use ClientMessage::*;
    match message {
        GetSettings => Ok(ServerMessage::GetSettings(
            state.settings.lock().await.clone(),
        )),
        UpdateSettings { settings } => {
            write_settings(state, settings).await?;
            Ok(ServerMessage::UpdateSettings)
        }
        GetNote { path } => Ok(ServerMessage::Note(read_note(state, &path).await?)),
        UpdateNote { path, note } => {
            write_note(state, &path, note).await?;
            Ok(ServerMessage::UpdateNote)
        }
        UpdatePath {
            current_path,
            new_title,
        } => Ok(ServerMessage::UpdatePath(
            update_path(state, current_path, new_title).await?,
        )),
        CreateNote { title } => {
            let path = create_note(state, title).await?;
            Ok(ServerMessage::CreateNote(path))
        }
        CreatePalette {
            palette_key,
            filters,
        } => Ok(ServerMessage::CreatePalette(
            create_palette(state, palette_key, filters).await?,
        )),
        SearchPalette {
            id,
            search,
            start,
            end,
        } => Ok(ServerMessage::SearchPalette(
            search_palette(state, id, search, start..end).await?,
        )),
        DeletePalette { id } => {
            delete_palette(state, id).await;
            Ok(ServerMessage::DeletePalette)
        }
        CreateSuggester { suggester_source } => Ok(ServerMessage::CreateSuggester(
            create_suggester(state, suggester_source).await?,
        )),
        SearchSuggester { id, search } => Ok(ServerMessage::SearchSuggester(
            search_suggester(state, id, search).await?,
        )),
        DeleteSuggester { id } => {
            delete_suggester(state, id).await;
            Ok(ServerMessage::DeleteSuggester)
        }
        GetPinned => Ok(ServerMessage::GetPinned(
            read_meta(state, |holder| holder.meta().pinned.clone()).await?,
        )),
        AddPinned { path, position } => {
            if read_meta(state, |holder| holder.meta().pinned.contains(&path)).await? {
                return Ok(ServerMessage::AddPinned);
            }
            write_meta(state, |holder| {
                holder.update_meta(|meta| meta.pinned.insert(position, path.clone()))
            })
            .await?;
            Ok(ServerMessage::AddPinned)
        }
        RemovePinned { path } => {
            write_meta(state, |holder| {
                holder.update_meta(|meta| meta.pinned.retain(|p| *p != path));
            })
            .await?;
            Ok(ServerMessage::RemovePinned)
        }
        GetTagConfigs => Ok(ServerMessage::GetTagConfigs(
            read_meta(state, |holder| holder.meta().tag_configs.clone()).await?,
        )),
        Refresh => {
            *state.meta.lock().await = None;
            let config_path = state.config_path.clone();
            *state.settings.lock().await =
                tokio::task::spawn_blocking(move || read_settings_file(&config_path)).await??;
            *state.actions.lock().await = None;

            Ok(ServerMessage::Refresh)
        }
        GetActions => Ok(ServerMessage::GetActions(
            read_actions(state, |a| a.clone()).await?,
        )),
    }
}

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ServerResult {
    Ok { message: ServerMessage },
    Err { error: String },
}
pub async fn handle_message_and_errors(message: ClientMessage, state: &AppState) -> ServerResult {
    let response = handle_message(message, state).await;

    match response {
        Ok(message) => ServerResult::Ok { message },
        Err(error) => {
            println!("server err: {}", error.to_string());
            ServerResult::Err {
                error: error.to_string(),
            }
        }
    }
}
