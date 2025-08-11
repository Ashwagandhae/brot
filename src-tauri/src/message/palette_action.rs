use std::collections::HashMap;

use anyhow::Result;
use futures::future::join_all;
use serde::{Deserialize, Serialize};

use ts_rs::TS;

use crate::{
    message::{
        action::{read_actions, PartialAction, PartialActionFilter, PartialActionGenerator},
        meta::read_meta,
        title::path_to_title,
    },
    state::AppState,
};

#[derive(Serialize, Deserialize, TS, Clone)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct MatchedPaletteAction {
    pub indices: Vec<u32>,
    pub palette_action: PaletteAction,
}

#[derive(Serialize, Deserialize, TS, Clone)]
#[ts(export)]
pub struct PaletteAction {
    pub title: String,
    pub icon: Option<String>,
    pub shortcut: Option<String>,
    pub action: PartialAction,
}

pub async fn get_palette_actions(
    state: &AppState,
    palette_key: &str,
    filters: Vec<PartialActionFilter>,
) -> Result<Vec<PaletteAction>> {
    Ok(get_all_palette_actions(state, palette_key)
        .await?
        .into_iter()
        .filter(|command| {
            filters
                .iter()
                .all(|filter| !filter.matches(&command.action))
        })
        .collect())
}

fn split_title_icon(title_with_icon: &str) -> (String, Option<String>) {
    if title_with_icon.starts_with("!") {
        let (icon, title) = title_with_icon
            .split_once(" ")
            .unwrap_or((&title_with_icon, ""));
        (
            title.to_owned(),
            Some(icon.chars().skip(1).collect::<String>()),
        )
    } else {
        (title_with_icon.to_owned(), None)
    }
}

async fn get_all_palette_actions(
    state: &AppState,
    palette_key: &str,
) -> Result<Vec<PaletteAction>> {
    let shortcut_map = read_actions(state, |actions| {
        actions
            .shortcuts
            .iter()
            .map(|(shortcut, action)| (action.clone(), shortcut.clone()))
            .collect()
    })
    .await?;
    let palette_action_futures: anyhow::Result<_> = read_actions(state, |actions| {
        Ok(actions
            .palettes
            .get(palette_key)
            .ok_or_else(|| anyhow::anyhow!("invalid palette key"))?
            .iter()
            .map(|(title_with_icon, generator)| {
                let (title, icon) = split_title_icon(title_with_icon);
                generate_palette_actions(state, &shortcut_map, title, icon, generator.clone())
            })
            .collect::<Vec<_>>())
    })
    .await?;

    let unflattened_palette_actions = join_all(palette_action_futures?)
        .await
        .into_iter()
        .collect::<Result<Vec<_>>>()?;
    Ok(unflattened_palette_actions.into_iter().flatten().collect())
}

async fn generate_palette_actions(
    state: &AppState,
    shortcut_map: &HashMap<PartialAction, String>,
    title: String,
    icon: Option<String>,
    generator: PartialActionGenerator,
) -> Result<Vec<PaletteAction>> {
    let palette_actions: Vec<_> = if title.contains("$note_locater") {
        get_all_note_paths(state)
            .await?
            .into_iter()
            .map(|(locater, title_replace)| {
                let mut args = generator.args.clone();
                let index = args.iter().position(|a| a == "$note_locater");
                if let Some(index) = index {
                    args[index] = format!("note:{}", locater);
                }

                (
                    title.replace("$note_locater", &title_replace),
                    icon.clone(),
                    PartialAction {
                        key: generator.key.clone(),
                        args,
                    },
                )
            })
            .collect()
    } else if title.contains("$note_path") {
        get_all_note_paths(state)
            .await?
            .into_iter()
            .map(|(locater, title_replace)| {
                let mut args = generator.args.clone();
                let index = args.iter().position(|a| a == "$note_path");
                if let Some(index) = index {
                    args[index] = locater;
                }
                (
                    title.replace("$note_path", &title_replace),
                    icon.clone(),
                    PartialAction {
                        key: generator.key.clone(),
                        args,
                    },
                )
            })
            .collect()
    } else {
        vec![(
            title,
            icon,
            PartialAction {
                key: generator.key,
                args: generator.args,
            },
        )]
    };
    Ok(palette_actions
        .into_iter()
        .map(|(title, icon, action)| PaletteAction {
            shortcut: shortcut_map.get(&action).cloned(),
            title,
            icon,
            action,
        })
        .collect())
}

async fn get_all_note_paths(state: &AppState) -> Result<Vec<(String, String)>> {
    read_meta(state, |meta| {
        meta.notes
            .iter()
            .map(|(path, _)| (path.clone(), path_to_title(path)))
            .collect()
    })
    .await
}
