use anyhow::Result;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{
    message::{
        meta::read_meta, palette_action::Matched, searcher::SearcherId, tag::construct_all_tags,
    },
    state::AppState,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SuggesterSource {
    Tag,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct Suggestion {
    pub value: String,
}

pub async fn create_suggester(state: &AppState, _source: SuggesterSource) -> Result<SearcherId> {
    let suggestions = read_meta(state, |holder| {
        construct_all_tags(&holder.tags())
            .into_iter()
            .map(|s| Suggestion {
                value: s.to_string(),
            })
            .collect::<Vec<_>>()
    })
    .await?;
    let mut suggesters = state.suggesters.write().await;
    Ok(suggesters.new_searcher(&suggestions))
}

pub async fn search_suggester(
    state: &AppState,
    id: SearcherId,
    search: String,
) -> Result<Option<Vec<Matched<Suggestion>>>> {
    let suggesters = state.suggesters.read().await;
    Ok(suggesters.search(id, &search, 0..5).await?)
}

pub async fn delete_suggester(state: &AppState, id: SearcherId) {
    let mut suggesters = state.suggesters.write().await;
    suggesters.delete_searcher(id);
}
