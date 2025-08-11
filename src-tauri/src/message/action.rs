use std::{collections::HashMap, fmt};

use anyhow::Result;

use serde::{
    de::{self, MapAccess, Visitor},
    Deserialize, Deserializer, Serialize,
};
use ts_rs::TS;

use crate::{message::folder_manager::read, state::AppState};

const ACTIONS_PATH: &str = "brot_actions.toml";

#[derive(Serialize, Deserialize, TS, Clone, Default)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct Actions {
    pub shortcuts: HashMap<String, PartialAction>,
    pub palettes: HashMap<String, HashMap<String, PartialActionGenerator>>,
}

#[derive(Serialize, PartialEq, Eq, Hash, TS, Clone)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct PartialAction {
    pub key: String,
    pub args: Vec<String>,
}

#[derive(Serialize, TS, Clone)]
#[ts(export)]
#[serde(rename_all = "camelCase")]

pub struct PartialActionGenerator {
    pub key: String,
    pub args: Vec<String>,
}

#[derive(Serialize, Deserialize, TS, Clone)]
#[ts(export)]
#[serde(rename_all = "camelCase")]

pub struct PartialActionFilter {
    pub key: String,
    pub args: Vec<Option<String>>,
}

impl PartialActionFilter {
    pub fn matches(&self, action: &PartialAction) -> bool {
        self.key == action.key
            && self
                .args
                .iter()
                .zip(action.args.iter())
                .all(|(f, a)| f.as_ref().is_none_or(|f| f == a))
    }
}

pub async fn read_actions_file(state: &AppState) -> Result<Actions> {
    match read(state, ACTIONS_PATH).await? {
        Some(contents) => Ok(toml::from_str(&contents)?),
        None => Ok(Actions::default()),
    }
}

pub async fn read_actions<T>(
    state: &AppState,
    mut function: impl FnMut(&Actions) -> T,
) -> Result<T> {
    let mut guard = state.actions.lock().await;
    if let Some(ref actions) = *guard {
        Ok(function(actions))
    } else {
        let actions = read_actions_file(state).await?;
        let res = function(&actions);
        *guard = Some(actions);
        Ok(res)
    }
}

impl<'de> Deserialize<'de> for PartialActionGenerator {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let PartialAction { key, args } = PartialAction::deserialize(deserializer)?;
        Ok(PartialActionGenerator { key, args })
    }
}

impl<'de> Deserialize<'de> for PartialAction {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct PartialActionVisitor;

        impl<'de> Visitor<'de> for PartialActionVisitor {
            type Value = PartialAction;

            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("a string or a map with keys `key` and optional `args`")
            }

            fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
            where
                E: de::Error,
            {
                Ok(PartialAction {
                    key: v.to_string(),
                    args: vec![],
                })
            }

            fn visit_map<M>(self, mut map: M) -> Result<Self::Value, M::Error>
            where
                M: MapAccess<'de>,
            {
                let mut key = None;
                let mut args = None;

                while let Some(field) = map.next_key::<String>()? {
                    match field.as_str() {
                        "key" => {
                            if key.is_some() {
                                return Err(de::Error::duplicate_field("key"));
                            }
                            key = Some(map.next_value()?);
                        }
                        "args" => {
                            if args.is_some() {
                                return Err(de::Error::duplicate_field("args"));
                            }
                            args = Some(map.next_value()?);
                        }
                        other => {
                            return Err(de::Error::unknown_field(other, &["key", "args"]));
                        }
                    }
                }

                let key = key.ok_or_else(|| de::Error::missing_field("key"))?;
                let args = args.unwrap_or_default();

                Ok(PartialAction { key, args })
            }
        }

        deserializer.deserialize_any(PartialActionVisitor)
    }
}
