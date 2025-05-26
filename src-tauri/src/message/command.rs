use anyhow::Result;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use ts_rs::TS;

use crate::state::AppState;

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
    Goto {
        target: GotoTarget,
        new_window: bool,
    },
    Subcommand {
        subcommand: Subcommand,
    },
    AddPinned {
        insertion: Insertion,
        path: String,
    },
    RemovePinned,
    EditTitle,
}

#[derive(Serialize, Deserialize, TS, Clone)]
#[ts(export)]
#[serde(tag = "type")]
pub enum Insertion {
    Before,
    After,
}

#[derive(Serialize, Deserialize, TS, Clone)]
#[ts(export)]
#[serde(tag = "type")]
pub enum Subcommand {
    AddPinned { insertion: Insertion },
}

#[derive(Serialize, Deserialize, TS, Clone)]
#[ts(export)]
#[serde(tag = "type")]
pub enum GotoTarget {
    Note { path: String },
    Pinned,
    Settings,
    New,
}

#[derive(Serialize, Deserialize, TS, Clone, PartialEq, Eq)]
#[ts(export)]
#[serde(tag = "type")]
pub enum Locater {
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
    Subcommand { subcommand: Subcommand },
}

async fn get_all_notes(
    state: &AppState,
    app: Option<AppHandle>,
    locater: &Locater,
) -> Result<Vec<(String, NoteMeta)>> {
    read_meta(state, app, |meta| {
        meta.notes
            .iter()
            .filter(|(current_path, _)| match locater {
                Locater::Note { path } => path != *current_path,
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
    locater: Locater,
    palette_type: CommandPaletteType,
) -> Result<Vec<Command>> {
    Ok(get_all_commands(&state, app, &locater, &palette_type)
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
    locater: &Locater,
    palette_type: &CommandPaletteType,
) -> Result<Vec<Command>> {
    Ok(match palette_type {
        CommandPaletteType::Action => get_all_action_commands(locater).await,
        CommandPaletteType::Window { new } => {
            get_all_window_commands(state, app.clone(), locater, *new).await?
        }
        CommandPaletteType::Subcommand { subcommand } => {
            get_all_subcommand_commands(&subcommand, state, app, locater).await?
        }
    })
}

async fn get_all_subcommand_commands(
    sucommand: &Subcommand,
    state: &AppState,
    app: Option<AppHandle>,
    locater: &Locater,
) -> Result<Vec<Command>> {
    Ok(match sucommand {
        Subcommand::AddPinned { insertion } => {
            let pinned = read_meta(state, app.clone(), |meta| meta.pinned.clone()).await?;
            get_all_notes(state, app, locater)
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
                .collect()
        }
    })
}

async fn get_all_action_commands(locater: &Locater) -> Vec<Command> {
    let shared = vec![command(
        "create new",
        CommandAction::Goto {
            target: GotoTarget::New,
            new_window: false,
        },
    )];
    let pinned_and_note_shared: &[Command] =
        &[command("edit current title", CommandAction::EditTitle)];
    let specific = match locater {
        Locater::Pinned { focus_path } => match focus_path {
            Some(_) => [
                vec![
                    command(
                        "add new pinned before",
                        CommandAction::Subcommand {
                            subcommand: Subcommand::AddPinned {
                                insertion: Insertion::Before,
                            },
                        },
                    ),
                    command(
                        "add new pinned after",
                        CommandAction::Subcommand {
                            subcommand: Subcommand::AddPinned {
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
                    subcommand: Subcommand::AddPinned {
                        insertion: Insertion::Before,
                    },
                },
            )],
        },
        Locater::Note { .. } => pinned_and_note_shared.to_vec(),
        Locater::Settings => vec![],
        Locater::New => vec![],
    };
    [shared.as_slice(), specific.as_slice()].concat()
}

async fn get_all_window_commands(
    state: &AppState,
    app: Option<AppHandle>,
    locater: &Locater,
    new_window: bool,
) -> Result<Vec<Command>> {
    let notes: Vec<_> = get_all_notes(state, app, locater)
        .await?
        .into_iter()
        .map(|(path, note_meta)| Command {
            title: note_meta.title,
            action: CommandAction::Goto {
                target: GotoTarget::Note { path },
                new_window,
            },
        })
        .collect();
    let mut specific = Vec::new();
    if *locater != Locater::Settings {
        specific.push(command(
            "settings",
            CommandAction::Goto {
                target: GotoTarget::Settings,
                new_window,
            },
        ))
    }
    if !matches!(locater, Locater::Pinned { .. }) {
        specific.push(command(
            "pinned",
            CommandAction::Goto {
                target: GotoTarget::Pinned,
                new_window,
            },
        ))
    }
    if *locater != Locater::New {
        specific.push(command(
            "new",
            CommandAction::Goto {
                target: GotoTarget::New,
                new_window,
            },
        ))
    }
    Ok([notes.as_slice(), specific.as_slice()].concat())
}
