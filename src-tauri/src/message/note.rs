use anyhow::{bail, Result};
use serde::{Deserialize, Serialize};

use ts_rs::TS;

use crate::{
    message::{
        folder_manager::{read, remove_file, write},
        meta::{read_meta, read_note_meta, write_meta, write_note_meta},
        title::title_to_path,
    },
    state::AppState,
};

use super::folder_manager::file_exists;

#[derive(Serialize, Deserialize, TS, Clone)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub content: String,
    pub meta: NoteMeta,
}

impl Note {
    pub fn new() -> Self {
        Note {
            meta: NoteMeta { selection: None },
            content: "".to_owned(),
        }
    }
}

#[derive(Serialize, Deserialize, TS, Clone, Debug)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct NoteMeta {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub selection: Option<(u32, u32)>,
}

impl Default for NoteMeta {
    fn default() -> Self {
        Self { selection: None }
    }
}

pub async fn read_note(state: &AppState, path: &str) -> Result<Option<Note>> {
    println!("reading note {:?}", path);

    let meta = read_note_meta(state, path).await?;
    let content = read(state, path).await?;
    Ok(meta
        .zip(content)
        .map(|(meta, content)| Note { meta, content }))
}

pub async fn write_note(state: &AppState, path: &str, note: Note) -> Result<()> {
    println!("updating note {:?}", path);

    write_note_meta(state, path, note.meta).await?;
    write(state, path, note.content).await?;

    Ok(())
}

pub async fn create_note(state: &AppState, title: String) -> Result<Option<String>> {
    let path = create_note_path(state, &title).await?;
    println!("creating note {:?}", path);

    if let Some(path) = path.clone() {
        write_note(state, &path, Note::new()).await?;
    }
    Ok(path)
}

pub async fn delete_note(state: &AppState, path: &str) -> Result<()> {
    remove_file(state, &path).await?;
    write_meta(state, |meta| {
        meta.notes.remove_entry(path);
        meta.pinned.retain(|p| p != path);
    })
    .await?;
    Ok(())
}

/// Creates note path from title if that note path doesn't already exist, else returns None
async fn create_note_path(state: &AppState, title: &str) -> Result<Option<String>> {
    let path = title_to_path(title);
    Ok(if file_exists(state, &path).await? {
        None
    } else {
        Some(path)
    })
}

pub async fn update_path(
    state: &AppState,

    current_path: String,
    new_title: String,
) -> Result<Option<String>> {
    let new_path = create_note_path(state, &new_title).await?;
    if let Some(new_path) = new_path.clone() {
        let Some(note) = read_note(state, &current_path).await? else {
            bail!("note does not exist")
        };
        let pinned_index = read_meta(state, |meta| {
            meta.pinned.iter().position(|p| *p == current_path)
        })
        .await?;
        write_note(state, &new_path, note).await?;
        delete_note(state, &current_path).await?;

        if let Some(index) = pinned_index {
            write_meta(state, |meta| {
                meta.pinned.insert(index, new_path.clone());
            })
            .await?;
        }
    }
    Ok(new_path)
}
