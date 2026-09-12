use std::collections::{HashMap, HashSet};

use anyhow::Result;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{
    extract_typst::extract_first_metadata,
    message::{
        action::Actions,
        tag::{TitleWord, parse_title_words},
    },
    state::AppState,
};

use super::folder_manager::{read, read_dir};

#[derive(Serialize, Deserialize, Default, Clone, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct TagConfig {
    pub abbreviation: Option<String>,
    pub hue: Option<f32>,
}

pub struct FileDerivedWrapper {
    inner: FileDerived,
    loaded: bool,
}
impl FileDerivedWrapper {
    pub fn new() -> Self {
        Self {
            inner: FileDerived::new(),
            loaded: false,
        }
    }
    pub async fn get(&mut self, state: &AppState) -> Result<&FileDerived> {
        if !self.loaded {
            self.reload_files(state).await?;
        }

        Ok(&self.inner)
    }
    pub async fn get_mut(&mut self, state: &AppState) -> Result<&mut FileDerived> {
        if !self.loaded {
            self.reload_files(state).await?;
        }

        Ok(&mut self.inner)
    }
    pub async fn reload_files(&mut self, state: &AppState) -> Result<()> {
        let paths = read_dir(state)
            .await?
            .into_iter()
            .filter(|path| path.ends_with(".typ"));

        for path in self.inner.paths.clone() {
            self.inner.remove_file(&path);
        }
        for path in paths {
            let contents = read(state, &path).await?;
            if let Some(contents) = contents {
                self.inner.add_file(&path, &contents);
            }
        }

        Ok(())
    }
}

pub struct FileDerived {
    pin_config: SingleFileConfig<Vec<String>>,
    actions_config: SingleFileConfig<Actions>,
    tag_configs: TagConfigs,
    paths: HashSet<String>,
}

impl FileDerived {
    pub fn new() -> Self {
        Self {
            pin_config: SingleFileConfig::new("pin"),
            actions_config: SingleFileConfig::new("action"),
            tag_configs: TagConfigs::new(),
            paths: HashSet::new(),
        }
    }
    pub fn pin_config(&self) -> Option<&Vec<String>> {
        self.pin_config.get()
    }
    pub fn actions_config(&self) -> Option<&Actions> {
        self.actions_config.get()
    }
    pub fn tag_configs(&self) -> &HashMap<Vec<String>, TagConfig> {
        &self.tag_configs.0
    }
    pub fn paths(&self) -> &HashSet<String> {
        &self.paths
    }
}
impl FileUpdateWatcher for FileDerived {
    fn add_file(&mut self, path: &str, contents: &str) {
        self.paths.insert(path.to_owned());
        self.pin_config.add_file(path, contents);
        self.actions_config.add_file(path, contents);
        self.tag_configs.add_file(path, contents);
    }
    fn remove_file(&mut self, path: &str) {
        self.paths.remove(path);
        self.pin_config.remove_file(path);
        self.actions_config.remove_file(path);
        self.tag_configs.remove_file(path);
    }
}

// removes any files that aren't in the folder, and adds any files that are in meta

pub trait FileUpdateWatcher {
    fn add_file(&mut self, path: &str, contents: &str);
    fn remove_file(&mut self, path: &str);
}
pub struct TagConfigs(HashMap<Vec<String>, TagConfig>);
impl TagConfigs {
    fn new() -> Self {
        Self(HashMap::new())
    }
}

fn parse_starts_with_config(path: &str) -> Option<Vec<TitleWord>> {
    if let [TitleWord::Tag(first), rest @ ..] = parse_title_words(path).as_slice() {
        if let [first_tag_part] = &first[..] {
            if first_tag_part == "cfg" {
                return Some(rest.to_vec());
            }
        }
    }
    None
}

fn parse_tag_config_title(path: &str) -> Option<Vec<String>> {
    let title_words = parse_starts_with_config(path)?;
    if let [TitleWord::Tag(tag)] = &title_words[..] {
        Some(tag.clone())
    } else {
        None
    }
}

impl FileUpdateWatcher for TagConfigs {
    fn add_file(&mut self, path: &str, contents: &str) {
        let Some(tag) = parse_tag_config_title(path) else {
            return;
        };
        let Some(config) = extract_first_metadata(contents) else {
            return;
        };
        self.0.insert(tag, config);
    }
    fn remove_file(&mut self, path: &str) {
        let Some(tag) = parse_tag_config_title(path) else {
            return;
        };
        self.0.remove(&tag);
    }
}

pub struct SingleFileConfig<T> {
    key: String,
    config: Option<T>,
}

impl<T> SingleFileConfig<T> {
    fn new(key: &str) -> Self {
        Self {
            key: key.to_owned(),
            config: None,
        }
    }
    fn file_name_matches(&self, path: &str) -> bool {
        let Some(title_words) = parse_starts_with_config(path) else {
            return false;
        };
        if let [TitleWord::Content(word)] = &title_words[..] {
            word == &self.key
        } else {
            false
        }
    }
    fn get(&self) -> Option<&T> {
        self.config.as_ref()
    }
}

impl<T: for<'a> Deserialize<'a>> FileUpdateWatcher for SingleFileConfig<T> {
    fn add_file(&mut self, path: &str, contents: &str) {
        if self.file_name_matches(path) {
            let config = extract_first_metadata(contents);
            self.config = config
        }
    }
    fn remove_file(&mut self, path: &str) {
        if self.file_name_matches(path) {
            self.config = None;
        }
    }
}
