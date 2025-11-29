use std::collections::HashMap;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{
    message::tag::{tags_from_meta, TagNode},
    state::AppState,
};

use super::{
    folder_manager::{read, read_dir, write},
    note::NoteMeta,
};

#[derive(Serialize, Deserialize, Default, Clone)]
/// maps each note's path to NoteMeta
pub struct Meta {
    pub notes: HashMap<String, NoteMeta>,
    pub pinned: Vec<String>,
    pub tag_configs: HashMap<String, TagConfig>,
}

#[derive(Serialize, Deserialize, Default, Clone, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct TagConfig {
    pub abbreviation: Option<String>,
    pub hue: Option<f32>,
}

pub struct MetaHolder {
    meta: Meta,
    tags: Vec<TagNode>,
}

impl MetaHolder {
    fn new(meta: Meta) -> Self {
        Self {
            tags: tags_from_meta(&meta),
            meta,
        }
    }

    pub fn meta(&self) -> &Meta {
        &self.meta
    }

    pub fn tags(&self) -> &[TagNode] {
        &self.tags
    }

    pub fn update_meta<T>(&mut self, mut updater: impl FnMut(&mut Meta) -> T) -> T {
        let res = updater(&mut self.meta);
        self.tags = tags_from_meta(&self.meta);
        res
    }
}

const META_PATH: &str = "brot.json";

pub async fn read_meta_file(state: &AppState) -> Result<Meta> {
    match read(state, META_PATH).await? {
        Some(contents) => Ok(serde_json::from_str(&contents)?),
        None => {
            write(state, META_PATH, serde_json::to_string(&Meta::default())?).await?;
            Ok(Meta::default())
        }
    }
}

// removes any files that aren't in the folder, and adds any files that are in meta
async fn sync_meta(state: &AppState, meta: &mut Meta) -> Result<()> {
    meta.notes = read_dir(state)
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

pub async fn read_note_meta(state: &AppState, path: &str) -> Result<Option<NoteMeta>> {
    Ok(read_meta(state, |holder| {
        holder.meta.notes.get(path).as_deref().cloned()
    })
    .await?)
}

pub async fn read_meta<T>(
    state: &AppState,
    mut function: impl FnMut(&MetaHolder) -> T,
) -> Result<T> {
    let mut guard = state.meta.lock().await;
    if let Some(ref meta) = *guard {
        Ok(function(meta))
    } else {
        let mut meta = read_meta_file(state).await?;
        sync_meta(state, &mut meta).await?;
        let holder = MetaHolder::new(meta);
        let res = function(&holder);
        *guard = Some(holder);
        Ok(res)
    }
}

pub async fn write_meta<T>(
    state: &AppState,

    mut function: impl FnMut(&mut MetaHolder) -> T,
) -> Result<T> {
    let mut guard = state.meta.lock().await;
    if let Some(ref mut holder) = *guard {
        let res = function(holder);
        write(state, META_PATH, serde_json::to_string(&holder.meta())?).await?;
        Ok(res)
    } else {
        let meta = read_meta_file(state).await?;
        let mut holder = MetaHolder::new(meta);
        let res = function(&mut holder);
        write(state, META_PATH, serde_json::to_string(&holder.meta())?).await?;
        *guard = Some(holder);
        Ok(res)
    }
}

pub async fn write_note_meta(state: &AppState, path: &str, note_meta: NoteMeta) -> Result<()> {
    write_meta(state, move |holder| {
        holder.meta.notes.insert(path.to_owned(), note_meta.clone());
    })
    .await
}
