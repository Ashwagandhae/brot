use anyhow::{bail, Result};
use regex::Regex;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use ts_rs::TS;

use crate::{
    message::{
        folder_manager::{read_file, write_file},
        meta::{read_note_meta, write_note_meta},
    },
    state::AppState,
};

use super::folder_manager::file_exists;

#[derive(Serialize, Deserialize, TS, Clone)]
#[ts(export)]
pub struct Note {
    pub content: String,
    pub meta: NoteMeta,
}

impl Note {
    pub fn from_title(title: String) -> Self {
        Note {
            meta: NoteMeta { title },
            content: "".to_owned(),
        }
    }
}

#[derive(Serialize, Deserialize, TS, Clone)]
#[ts(export)]
pub struct NoteMeta {
    pub title: String,
}

pub async fn read_note(
    state: &AppState,
    app: Option<AppHandle>,
    path: &str,
) -> Result<Option<Note>> {
    println!("reading note {:?}", path);

    let meta = read_note_meta(state, app.clone(), path).await?;
    let content = read_file(state, app, path).await?;
    Ok(meta
        .zip(content)
        .map(|(meta, content)| Note { meta, content }))
}

pub async fn write_note(
    state: &AppState,
    app: Option<AppHandle>,
    path: &str,
    note: Note,
) -> Result<()> {
    println!("updating note {:?}", path);

    write_note_meta(state, app.clone(), path, note.meta).await?;
    write_file(state, app, path, note.content).await?;

    Ok(())
}

pub async fn create_note(
    state: &AppState,
    app: Option<AppHandle>,
    title: String,
) -> Result<String> {
    let path = create_note_path(state, app.clone(), &title).await?;
    println!("creating note {:?}", path);

    write_note(state, app.clone(), &path, Note::from_title(title)).await?;

    Ok(path)
}

fn sanitize_filename(input: &str) -> String {
    let re = Regex::new(r#"[\s<>:"/\\|?*\x00-\x1F]+"#).unwrap();
    let replaced = re.replace_all(input, "_");

    replaced.trim_matches('_').to_string()
}

pub async fn create_note_path(
    state: &AppState,
    app: Option<AppHandle>,
    title: &str,
) -> Result<String> {
    let stem = sanitize_filename(title);
    let path = format!("{}.md", stem);
    if !file_exists(state, app.clone(), &path).await? {
        return Ok(path);
    }
    let i = 1;
    while i < 9999 {
        let path = format!("{}_{}.md", stem, i);
        if !file_exists(state, app.clone(), &path).await? {
            return Ok(path);
        }
    }
    bail!("attempted to create note path too many times")
}
