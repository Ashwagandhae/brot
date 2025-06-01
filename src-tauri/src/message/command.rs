use anyhow::Result;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use ts_rs::TS;

use crate::{message::locater::Locater, state::AppState};

use super::{meta::read_meta, note::NoteMeta};

#[derive(Serialize, Deserialize, TS, Clone)]
#[ts(export)]
pub struct Command {
    title: String,
    action: CommandAction,
}

#[derive(Serialize, Deserialize, TS, Clone)]
#[ts(export)]
#[serde(tag = "type")]
pub enum CommandAction {
    Goto { target: Locater, new_window: bool },
    Subcommand { subcommand: CommandPaletteType },
    AddPinned { insertion: Insertion, path: String },
    RemovePinned,
    EditTitle,
    SaveWindowState,
    SaveNote,
    ToggleNoteMinimized,
}

#[derive(Serialize, Deserialize, TS, Clone)]
#[ts(export)]
#[serde(tag = "type")]
pub enum Insertion {
    Before,
    After,
}

#[derive(Serialize, Deserialize, TS, Clone, PartialEq, Eq)]
#[ts(export)]
#[serde(tag = "type")]
pub enum ViewState {
    Note { path: String },
    Pinned { focus_path: Option<String> },
    Settings,
    New,
}

#[derive(Serialize, Deserialize, TS, Clone)]
#[ts(export)]
#[serde(tag = "type")]
pub enum CommandPaletteType {
    Action,
    Window { new: bool },
    AddPinned { insertion: Insertion },
}

async fn get_all_notes(
    state: &AppState,
    app: Option<AppHandle>,
    view_state: &ViewState,
) -> Result<Vec<(String, NoteMeta)>> {
    read_meta(state, app, |meta| {
        meta.notes
            .iter()
            .filter(|(current_path, _)| match view_state {
                ViewState::Note { path } => path != *current_path,
                _ => true,
            })
            .map(|(path, note_meta)| (path.clone(), note_meta.clone()))
            .collect::<Vec<_>>()
    })
    .await
}

pub async fn get_commands(
    state: &AppState,
    app: Option<AppHandle>,
    search: String,
    view_state: ViewState,
    palette_type: CommandPaletteType,
) -> Result<Vec<Command>> {
    Ok(get_all_commands(&state, app, &view_state, &palette_type)
        .await?
        .into_iter()
        .filter(|command| {
            if search.len() == 0 {
                return true;
            }
            search
                .split_whitespace()
                .all(|word| command.title.contains(word))
        })
        .take(5)
        .collect())
}

fn command(title: &str, action: CommandAction) -> Command {
    Command {
        title: title.to_owned(),
        action,
    }
}

async fn get_all_commands(
    state: &AppState,
    app: Option<AppHandle>,
    view_state: &ViewState,
    palette_type: &CommandPaletteType,
) -> Result<Vec<Command>> {
    Ok(match palette_type {
        CommandPaletteType::Action => get_all_action_commands(view_state).await,
        CommandPaletteType::Window { new } => {
            get_all_window_commands(state, app.clone(), view_state, *new).await?
        }
        CommandPaletteType::AddPinned { insertion } => {
            get_all_add_pinned_commands(&insertion, state, app, view_state).await?
        }
    })
}

async fn get_all_add_pinned_commands(
    insertion: &Insertion,
    state: &AppState,
    app: Option<AppHandle>,
    view_state: &ViewState,
) -> Result<Vec<Command>> {
    let pinned = read_meta(state, app.clone(), |meta| meta.pinned.clone()).await?;
    Ok(get_all_notes(state, app, view_state)
        .await?
        .into_iter()
        .filter(|(path, _)| !pinned.contains(path))
        .map(|(path, note_meta)| Command {
            title: note_meta.title,
            action: CommandAction::AddPinned {
                insertion: insertion.clone(),
                path,
            },
        })
        .collect())
}

async fn get_all_action_commands(view_state: &ViewState) -> Vec<Command> {
    let shared = vec![
        command("save window state", CommandAction::SaveWindowState),
        command(
            "open",
            CommandAction::Subcommand {
                subcommand: CommandPaletteType::Window { new: false },
            },
        ),
        command(
            "open out",
            CommandAction::Subcommand {
                subcommand: CommandPaletteType::Window { new: true },
            },
        ),
    ];
    let pinned_and_note_shared: &[Command] = &[
        command("edit current title", CommandAction::EditTitle),
        command("save", CommandAction::SaveNote),
        command("toggle minimized", CommandAction::ToggleNoteMinimized),
    ];
    let specific = match view_state {
        ViewState::Pinned { focus_path } => match focus_path {
            Some(_) => [
                vec![
                    command(
                        "add new pinned before",
                        CommandAction::Subcommand {
                            subcommand: CommandPaletteType::AddPinned {
                                insertion: Insertion::Before,
                            },
                        },
                    ),
                    command(
                        "add new pinned after",
                        CommandAction::Subcommand {
                            subcommand: CommandPaletteType::AddPinned {
                                insertion: Insertion::After,
                            },
                        },
                    ),
                    command("remove pinned", CommandAction::RemovePinned),
                ]
                .as_slice(),
                pinned_and_note_shared,
            ]
            .concat(),
            None => vec![command(
                "add new pinned",
                CommandAction::Subcommand {
                    subcommand: CommandPaletteType::AddPinned {
                        insertion: Insertion::After,
                    },
                },
            )],
        },
        ViewState::Note { .. } => pinned_and_note_shared.to_vec(),
        ViewState::Settings => vec![],
        ViewState::New => vec![],
    };
    [shared.as_slice(), specific.as_slice()].concat()
}

async fn get_all_window_commands(
    state: &AppState,
    app: Option<AppHandle>,
    view_state: &ViewState,
    new_window: bool,
) -> Result<Vec<Command>> {
    let notes: Vec<_> = get_all_notes(state, app, view_state)
        .await?
        .into_iter()
        .map(|(path, note_meta)| Command {
            title: note_meta.title,
            action: CommandAction::Goto {
                target: Locater::Note { path },
                new_window,
            },
        })
        .collect();
    let mut specific = Vec::new();
    if *view_state != ViewState::Settings {
        specific.push(command(
            "settings",
            CommandAction::Goto {
                target: Locater::Settings,
                new_window,
            },
        ))
    }
    if !matches!(view_state, ViewState::Pinned { .. }) {
        specific.push(command(
            "pinned",
            CommandAction::Goto {
                target: Locater::Pinned,
                new_window,
            },
        ))
    }
    specific.push(command(
        "new",
        CommandAction::Goto {
            target: Locater::New,
            new_window,
        },
    ));
    Ok([notes.as_slice(), specific.as_slice()].concat())
}
