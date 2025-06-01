use serde::{Deserialize, Deserializer, Serialize, Serializer};
use ts_rs::TS;

#[derive(Clone, Hash, PartialEq, Eq, TS)]
#[ts(export)]
#[ts(type = "`note:${string}` | 'pinned' | 'settings' | 'new'")]
pub enum Locater {
    Note { path: String },
    Pinned,
    Settings,
    New,
}

impl Serialize for Locater {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let s = match self {
            Locater::Note { path } => format!("note:{}", path),
            Locater::Pinned => "pinned".to_string(),
            Locater::Settings => "settings".to_string(),
            Locater::New => "new".to_string(),
        };
        serializer.serialize_str(&s)
    }
}

impl<'de> Deserialize<'de> for Locater {
    fn deserialize<D>(deserializer: D) -> Result<Locater, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;

        if let Some(rest) = s.strip_prefix("note:") {
            Ok(Locater::Note {
                path: rest.to_string(),
            })
        } else {
            match s.as_str() {
                "pinned" => Ok(Locater::Pinned),
                "settings" => Ok(Locater::Settings),
                "new" => Ok(Locater::New),
                _ => Err(serde::de::Error::custom(format!(
                    "Invalid Locater string: {}",
                    s
                ))),
            }
        }
    }
}
