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

use crate::message::palette_action::Matched;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
#[ts(export, type = "number & { readonly __tag: unique symbol }")]
pub struct SearcherId(usize);
pub struct SearcherManager<T: Clone + Send + Sync + 'static> {
    palettes: HashMap<SearcherId, Arc<Mutex<Searcher<T>>>>,
    id_counter: usize,
    get_action_search: fn(&T) -> String,
}

impl<T: Clone + Send + Sync + 'static> SearcherManager<T> {
    pub fn new(get_action_search: fn(&T) -> String) -> Self {
        Self {
            palettes: HashMap::new(),
            id_counter: 0,
            get_action_search,
        }
    }

    fn new_id(&mut self) -> SearcherId {
        let id = SearcherId(self.id_counter);
        self.id_counter += 1;
        id
    }

    pub fn new_searcher(&mut self, actions: &[T]) -> SearcherId {
        let id = self.new_id();
        self.palettes.insert(
            id,
            Arc::new(Mutex::new(Searcher::new(actions, self.get_action_search))),
        );
        id
    }

    pub fn delete_searcher(&mut self, id: SearcherId) {
        self.palettes.remove(&id);
    }

    pub async fn search(
        &self,
        id: SearcherId,
        search: &str,
        range: Range<u32>,
    ) -> Result<Option<Vec<Matched<T>>>> {
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

struct Searcher<T: Clone + Send + Sync + 'static> {
    nucleo: Nucleo<T>,
    matcher: Matcher,
    last_search: Option<String>,
    get_action_search: fn(&T) -> String,
}

impl<T: Clone + Send + Sync + 'static> Searcher<T> {
    fn new(actions: &[T], get_action_search: fn(&T) -> String) -> Self {
        let config = nucleo::Config::DEFAULT;
        let nucleo = Nucleo::new(config.clone(), Arc::new(|| {}), None, 1);
        let matcher = Matcher::new(config.clone());

        let injector = nucleo.injector();
        for action in actions {
            injector.push(action.clone(), |action, strings| {
                strings[0] = Utf32String::from(get_action_search(action));
            });
        }

        Self {
            nucleo,
            matcher,
            last_search: None,
            get_action_search,
        }
    }

    fn search(&mut self, search: &str, range: Range<u32>) -> Vec<Matched<T>> {
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
        let start = range.start.min(count);
        let end = range.end.min(count);
        snapshot
            .matched_items(start..end)
            .map(|item| {
                let mut haystack_buf = Vec::new();
                let search = (self.get_action_search)(&item.data);
                let haystack = Utf32Str::new(&search, &mut haystack_buf);
                let mut indices = Vec::new();
                pattern
                    .column_pattern(0)
                    .indices(haystack, &mut self.matcher, &mut indices);

                Matched {
                    indices,
                    payload: item.data.clone(),
                }
            })
            .collect()
    }
}
