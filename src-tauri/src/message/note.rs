use anyhow::{Result, bail};
use serde::{Deserialize, Serialize};

use ts_rs::TS;

use crate::{message::title::title_to_path, state::AppState};

#[derive(Serialize, Deserialize, TS, Clone)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub content: String,
}

impl Note {
    pub fn new() -> Self {
        Note {
            content: "".to_owned(),
        }
    }
}

pub async fn read_note(state: &AppState, path: &str) -> Result<Option<Note>> {
    println!("reading note {:?}", path);

    let content = state.file_manager.read(path).await?;
    Ok(content.map(|content| Note { content }))
}

pub async fn write_note(state: &AppState, path: &str, note: Note) -> Result<()> {
    println!("updating note {:?}", path);

    state.file_manager.write(path, note.content).await?;

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
    state.file_manager.remove_file(&path).await?;
    Ok(())
}

/// Creates note path from title if that note path doesn't already exist, else returns None
async fn create_note_path(state: &AppState, title: &str) -> Result<Option<String>> {
    let path = title_to_path(title);
    Ok(if state.file_manager.file_exists(&path).await? {
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
        write_note(state, &new_path, note).await?;
        delete_note(state, &current_path).await?;
    }
    Ok(new_path)
}
