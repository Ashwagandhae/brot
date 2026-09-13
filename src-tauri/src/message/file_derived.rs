use std::collections::{HashMap, HashSet};

use anyhow::Result;
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use ts_rs::TS;

use crate::{
    extract_typst::extract_first_metadata,
    message::{
        action::Actions,
        file_manager::LazyFile,
        tag::{TitleWord, parse_title_words},
    },
};

#[derive(Serialize, Deserialize, Default, Clone, TS, Debug)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct TagConfig {
    pub abbreviation: Option<String>,
    pub hue: Option<f32>,
}

#[derive(Debug, Clone)]
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
    async fn add_file_action(
        &self,
        path: &str,
        contents: &LazyFile,
    ) -> Result<Option<impl FnOnce(&mut Self) + 'static>> {
        let pin_action = self.pin_config.add_file_action(path, contents).await?;
        let actions_action = self.actions_config.add_file_action(path, contents).await?;
        let tag_action = self.tag_configs.add_file_action(path, contents).await?;
        let path = path.to_owned();
        Ok(Some(move |sel: &mut FileDerived| {
            sel.paths.insert(path);
            if let Some(pin_action) = pin_action {
                pin_action(&mut sel.pin_config)
            }
            if let Some(actions_action) = actions_action {
                actions_action(&mut sel.actions_config)
            }
            if let Some(tag_action) = tag_action {
                tag_action(&mut sel.tag_configs)
            }
        }))
    }
    fn remove_file_action(&self, path: &str) -> Option<impl FnOnce(&mut Self) + 'static> {
        let pin_action = self.pin_config.remove_file_action(path);
        let actions_action = self.actions_config.remove_file_action(path);
        let tag_action = self.tag_configs.remove_file_action(path);
        let path = path.to_owned();
        Some(move |sel: &mut FileDerived| {
            sel.paths.remove(&path);
            if let Some(pin_action) = pin_action {
                pin_action(&mut sel.pin_config)
            }
            if let Some(actions_action) = actions_action {
                actions_action(&mut sel.actions_config)
            }
            if let Some(tag_action) = tag_action {
                tag_action(&mut sel.tag_configs)
            }
        })
    }
}

// removes any files that aren't in the folder, and adds any files that are in meta

pub trait FileUpdateWatcher {
    fn add_file_action(
        &self,
        path: &str,
        contents: &LazyFile,
    ) -> impl std::future::Future<Output = Result<Option<impl FnOnce(&mut Self) + 'static>>>;
    fn remove_file_action(&self, path: &str) -> Option<impl FnOnce(&mut Self) + 'static>;
    fn add_file(
        &mut self,
        path: &str,
        contents: &LazyFile,
    ) -> impl std::future::Future<Output = Result<()>> {
        async {
            let action = self.add_file_action(path, contents).await?;
            if let Some(action) = action {
                action(self);
            }
            Ok(())
        }
    }
    fn remove_file(&mut self, path: &str) {
        let action = self.remove_file_action(path);
        if let Some(action) = action {
            action(self);
        }
    }
}
#[derive(Debug, Clone)]
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
    async fn add_file_action(
        &self,
        path: &str,
        contents: &LazyFile,
    ) -> Result<Option<impl FnOnce(&mut Self) + 'static>> {
        let Some(tag) = parse_tag_config_title(path) else {
            return Ok(None);
        };
        let Some(contents) = contents.get().await? else {
            return Ok(None);
        };
        let Some(config) = extract_first_metadata(contents) else {
            return Ok(None);
        };
        Ok(Some(move |sel: &mut TagConfigs| {
            sel.0.insert(tag, config);
        }))
    }
    fn remove_file_action(&self, path: &str) -> Option<impl FnOnce(&mut Self) + 'static> {
        let Some(tag) = parse_tag_config_title(path) else {
            return None;
        };
        Some(move |sel: &mut TagConfigs| {
            sel.0.remove(&tag);
        })
    }
}

#[derive(Debug, Clone)]
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

impl<T: DeserializeOwned + 'static> FileUpdateWatcher for SingleFileConfig<T> {
    async fn add_file_action(
        &self,
        path: &str,
        contents: &LazyFile,
    ) -> Result<Option<impl FnOnce(&mut Self) + 'static>> {
        if self.file_name_matches(path) {
            let contents = contents.get().await?;
            if let Some(contents) = contents {
                let config = extract_first_metadata(contents);
                return Ok(Some(move |sel: &mut SingleFileConfig<T>| {
                    sel.config = config
                }));
            }
        }
        Ok(None)
    }
    fn remove_file_action(&self, path: &str) -> Option<impl FnOnce(&mut Self) + 'static> {
        if self.file_name_matches(path) {
            Some(|sel: &mut SingleFileConfig<T>| {
                sel.config = None;
            })
        } else {
            None
        }
    }
}
