use anyhow::Result;
use futures::future::join_all;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
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
pub struct PaletteAction {
    pub title: String,
    pub icon: Option<String>,
    pub action: PartialAction,
}

pub async fn get_palette_actions(
    state: &AppState,
    app: &Option<AppHandle>,
    palette_key: &str,
    search: &str,
    filters: Vec<PartialActionFilter>,
) -> Result<Vec<PaletteAction>> {
    Ok(get_all_palette_actions(state, &app, palette_key)
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
        .filter(|command| {
            filters
                .iter()
                .all(|filter| !filter.matches(&command.action))
        })
        .take(10)
        .collect())
}

pub fn split_title_icon(title_with_icon: &str) -> (String, Option<String>) {
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

pub async fn get_all_palette_actions(
    state: &AppState,
    app: &Option<AppHandle>,
    palette_key: &str,
) -> Result<Vec<PaletteAction>> {
    let palette_action_futures: anyhow::Result<_> = read_actions(state, app.clone(), |actions| {
        Ok(actions
            .palettes
            .get(palette_key)
            .ok_or_else(|| anyhow::anyhow!("invalid palette key"))?
            .iter()
            .map(|(title_with_icon, generator)| {
                let (title, icon) = split_title_icon(title_with_icon);
                generate_palette_actions(state, app, title, icon, generator.clone())
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

pub async fn generate_palette_actions(
    state: &AppState,
    app: &Option<AppHandle>,
    title: String,
    icon: Option<String>,
    generator: PartialActionGenerator,
) -> Result<Vec<PaletteAction>> {
    Ok(if title.contains("$note_locater") {
        get_all_note_paths(state, app)
            .await?
            .into_iter()
            .map(|(locater, title_replace)| {
                let mut args = generator.args.clone();
                let index = args.iter().position(|a| a == "$note_locater");
                if let Some(index) = index {
                    args[index] = format!("note:{}", locater);
                }
                PaletteAction {
                    title: title.replace("$note_locater", &title_replace),
                    icon: icon.clone(),
                    action: PartialAction {
                        key: generator.key.clone(),
                        args,
                    },
                }
            })
            .collect()
    } else if title.contains("$note_path") {
        get_all_note_paths(state, app)
            .await?
            .into_iter()
            .map(|(locater, title_replace)| {
                let mut args = generator.args.clone();
                let index = args.iter().position(|a| a == "$note_path");
                if let Some(index) = index {
                    args[index] = locater;
                }
                PaletteAction {
                    title: title.replace("$note_path", &title_replace),
                    icon: icon.clone(),
                    action: PartialAction {
                        key: generator.key.clone(),
                        args,
                    },
                }
            })
            .collect()
    } else {
        vec![PaletteAction {
            title,
            icon,
            action: PartialAction {
                key: generator.key,
                args: generator.args,
            },
        }]
    })
}

async fn get_all_note_paths(
    state: &AppState,
    app: &Option<AppHandle>,
) -> Result<Vec<(String, String)>> {
    read_meta(state, app.clone(), |meta| {
        meta.notes
            .iter()
            .map(|(path, _)| (path.clone(), path_to_title(path)))
            .collect()
    })
    .await
}
