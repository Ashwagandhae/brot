use std::collections::HashMap;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::state::AppState;

use super::{
    folder_manager::{read, read_dir, write},
    note::NoteMeta,
};

#[derive(Serialize, Deserialize, Default, Clone)]
/// maps each note's path to NoteMeta
pub struct Meta {
    pub notes: HashMap<String, NoteMeta>,
    pub pinned: Vec<String>,
}

const META_PATH: &str = "brot.json";

pub async fn read_meta_file(state: &AppState, app: Option<AppHandle>) -> Result<Meta> {
    match read(state, app.clone(), META_PATH).await? {
        Some(contents) => Ok(serde_json::from_str(&contents)?),
        None => {
            write(
                state,
                app,
                META_PATH,
                serde_json::to_string(&Meta::default())?,
            )
            .await?;
            Ok(Meta::default())
        }
    }
}

// removes any files that aren't in the folder, and adds any files that are in meta
async fn sync_meta(state: &AppState, app: Option<AppHandle>, meta: &mut Meta) -> Result<()> {
    meta.notes = read_dir(state, app)
        .await?
        .into_iter()
        .filter(|path| path.ends_with(".md"))
        .map(|path| {
            let val = meta.notes.get(&path).cloned();
            (path, val.unwrap_or_default())
        })
        .collect();
    Ok(())
}

pub async fn read_note_meta(
    state: &AppState,
    app: Option<AppHandle>,
    path: &str,
) -> Result<Option<NoteMeta>> {
    Ok(read_meta(state, app, |meta| meta.notes.get(path).as_deref().cloned()).await?)
}

pub async fn read_meta<T>(
    state: &AppState,
    app: Option<AppHandle>,
    mut function: impl FnMut(&Meta) -> T,
) -> Result<T> {
    let mut guard = state.meta.lock().await;
    if let Some(ref meta) = *guard {
        Ok(function(meta))
    } else {
        let mut meta = read_meta_file(state, app.clone()).await?;
        sync_meta(state, app, &mut meta).await?;
        let res = function(&meta);
        *guard = Some(meta);
        Ok(res)
    }
}

pub async fn write_meta<T>(
    state: &AppState,
    app: Option<AppHandle>,
    mut function: impl FnMut(&mut Meta) -> T,
) -> Result<T> {
    let mut guard = state.meta.lock().await;
    if let Some(ref mut meta) = *guard {
        let res = function(meta);
        write(state, app, META_PATH, serde_json::to_string(&meta)?).await?;
        Ok(res)
    } else {
        let mut meta = read_meta_file(state, app.clone()).await?;
        let res = function(&mut meta);
        write(state, app, META_PATH, serde_json::to_string(&meta)?).await?;
        *guard = Some(meta);
        Ok(res)
    }
}

pub async fn write_note_meta(
    state: &AppState,
    app: Option<AppHandle>,
    path: &str,
    note_meta: NoteMeta,
) -> Result<()> {
    write_meta(state, app, move |meta| {
        meta.notes.insert(path.to_owned(), note_meta.clone());
    })
    .await
}
