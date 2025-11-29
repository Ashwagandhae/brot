use std::ops::Range;

use anyhow::Result;

use crate::message::palette_action::{get_palette_actions, Matched, PaletteAction};
use crate::message::{action::PartialActionFilter, searcher::SearcherId};
use crate::state::AppState;

pub async fn create_palette(
    state: &AppState,
    palette_key: String,
    filters: Vec<PartialActionFilter>,
) -> Result<SearcherId> {
    let actions = get_palette_actions(state, &palette_key, filters).await?;
    let mut palettes = state.palettes.write().await;
    Ok(palettes.new_searcher(&actions))
}

pub async fn search_palette(
    state: &AppState,
    id: SearcherId,
    search: String,
    range: Range<u32>,
) -> Result<Option<Vec<Matched<PaletteAction>>>> {
    let palettes = state.palettes.read().await;
    Ok(palettes.search(id, &search, range).await?)
}

pub async fn delete_palette(state: &AppState, id: SearcherId) {
    let mut palettes = state.palettes.write().await;
    palettes.delete_searcher(id);
}
