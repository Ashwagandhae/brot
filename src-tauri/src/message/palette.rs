use std::collections::HashMap;
use std::ops::Range;
use std::sync::Arc;

use anyhow::Result;
use nucleo::{
    pattern::{CaseMatching, Normalization},
    Nucleo, Utf32String,
};
use nucleo::{Matcher, Utf32Str};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use ts_rs::TS;

use crate::message::action::PartialActionFilter;
use crate::message::palette_action::{get_palette_actions, MatchedPaletteAction, PaletteAction};
use crate::state::AppState;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
#[ts(export, type = "number & { readonly __tag: unique symbol }")]
pub struct PaletteId(usize);
pub struct Palettes {
    palettes: HashMap<PaletteId, Arc<Mutex<Palette>>>,
    id_counter: usize,
}

pub async fn create_palette(
    state: &AppState,
    palette_key: String,
    filters: Vec<PartialActionFilter>,
) -> Result<PaletteId> {
    let actions = get_palette_actions(state, &palette_key, filters).await?;
    let mut palettes = state.palettes.write().await;
    Ok(palettes.new_palette(&actions))
}

pub async fn search_palette(
    state: &AppState,
    id: PaletteId,
    search: String,
    range: Range<u32>,
) -> Result<Option<Vec<MatchedPaletteAction>>> {
    let palettes = state.palettes.read().await;
    Ok(palettes.search_palette(id, &search, range).await?)
}

impl Palettes {
    pub fn new() -> Self {
        Self {
            palettes: HashMap::new(),
            id_counter: 0,
        }
    }

    fn new_id(&mut self) -> PaletteId {
        let id = PaletteId(self.id_counter);
        self.id_counter += 1;
        id
    }

    pub fn new_palette(&mut self, actions: &[PaletteAction]) -> PaletteId {
        let id = self.new_id();
        self.palettes
            .insert(id, Arc::new(Mutex::new(Palette::new(actions))));
        id
    }

    pub async fn search_palette(
        &self,
        id: PaletteId,
        search: &str,
        range: Range<u32>,
    ) -> Result<Option<Vec<MatchedPaletteAction>>> {
        let Some(palette) = self.palettes.get(&id) else {
            return Ok(None);
        };
        let palette = palette.clone();
        let search = search.to_string();
        let range = range.clone();

        let result = tokio::task::spawn_blocking(move || {
            let mut palette = palette.blocking_lock();
            palette.search(&search, range)
        })
        .await
        .map_err(|e| anyhow::anyhow!("task panicked: {}", e))?;

        Ok(Some(result))
    }
}

pub struct Palette {
    nucleo: Nucleo<PaletteAction>,
    matcher: Matcher,
    last_search: Option<String>,
}

impl Palette {
    fn new(actions: &[PaletteAction]) -> Self {
        let config = nucleo::Config::DEFAULT;
        let nucleo = Nucleo::new(config.clone(), Arc::new(|| {}), None, 1);
        let matcher = Matcher::new(config.clone());

        let injector = nucleo.injector();
        for action in actions {
            injector.push(action.clone(), |action, strings| {
                strings[0] = Utf32String::from(action.title.clone());
            });
        }

        Self {
            nucleo,
            matcher,
            last_search: None,
        }
    }

    fn search(&mut self, search: &str, range: Range<u32>) -> Vec<MatchedPaletteAction> {
        let append = self
            .last_search
            .as_ref()
            .is_some_and(|last_search| search.starts_with(last_search));
        self.last_search = Some(search.to_owned());
        self.nucleo
            .pattern
            .reparse(0, search, CaseMatching::Smart, Normalization::Smart, append);
        let status = self.nucleo.tick(10);
        if status.running {
            println!("palette still running");
        }
        let snapshot = self.nucleo.snapshot();
        let count = snapshot.matched_item_count();
        if count == 0 {
            return Vec::new();
        }
        let pattern = snapshot.pattern();
        let start = range.start.min(count - 1);
        let end = range.end.min(count);
        snapshot
            .matched_items(start..end)
            .map(|item| {
                let mut haystack_buf = Vec::new();
                let haystack = Utf32Str::new(&item.data.title, &mut haystack_buf);
                let mut indices = Vec::new();
                pattern
                    .column_pattern(0)
                    .indices(haystack, &mut self.matcher, &mut indices);

                MatchedPaletteAction {
                    indices,
                    palette_action: item.data.clone(),
                }
            })
            .collect()
    }
}
