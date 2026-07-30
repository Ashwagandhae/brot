use serde::{Deserialize, Serialize};
use span_index::SpanIndex;
use std::{collections::HashMap, ops::Range};
use ts_rs::TS;
use typst::{WorldExt, diag::Warned};
use utf16::{Utf16Index, to_utf8_range, to_utf16_range};
use world::SimpleWorld;

use typst_html::HtmlDocument;

pub mod html_node;
pub mod span_index;
pub mod utf16;
pub mod world;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub enum SourceChange {
    Replace(String),
    Edits(Vec<(Range<Utf16Index>, String)>),
}

pub struct Previewer {
    worlds: HashMap<String, SimpleWorld>,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type")]
pub enum UpdateSourceError {
    NoMainSource,
    CompileFailure { diags: Vec<Diagnostic> },
    Uninitialized,
    WrongVersion,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Diagnostic {
    range: Range<Utf16Index>,
    message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type")]
pub enum PreviewerResult {
    Ok { value: SpanIndex },
    Err { err: UpdateSourceError },
}
impl Previewer {
    pub fn new() -> Self {
        Self {
            worlds: HashMap::new(),
        }
    }
    pub fn update_source(
        &mut self,
        change: SourceChange,
        editor_view_id: String,
    ) -> PreviewerResult {
        let res = self.update_source_res(change, editor_view_id);
        match res {
            Ok(value) => PreviewerResult::Ok { value },
            Err(err) => {
                println!("got err, {:?}", err);
                PreviewerResult::Err { err }
            }
        }
    }
    pub fn close_editor_view(&mut self, editor_view_id: String) {
        self.worlds.remove(&editor_view_id);
    }
    fn update_source_res(
        &mut self,
        change: SourceChange,
        editor_view_id: String,
    ) -> Result<SpanIndex, UpdateSourceError> {
        let world = self
            .worlds
            .entry(editor_view_id)
            .or_insert(SimpleWorld::new());

        let source = world.main_source_mut();
        match change {
            SourceChange::Replace(new_source) => {
                source.replace(&new_source);
            }
            SourceChange::Edits(edits) => {
                for (range, replacement) in &edits {
                    let range = to_utf8_range(source.text(), range).expect("invalid range");
                    source.edit(range.clone(), replacement);
                }
            }
        }
        let Warned { output, .. } = typst::compile::<HtmlDocument>(world);
        let text = world.main_source().text();
        let document = output.map_err(|diags| UpdateSourceError::CompileFailure {
            diags: diags
                .iter()
                .filter_map(|diag| {
                    Some(Diagnostic {
                        range: to_utf16_range(&text, &world.range(diag.span)?)?,
                        message: diag.message.to_string(),
                    })
                })
                .collect(),
        })?;
        Ok(SpanIndex::new(&world, &document))
    }
}
