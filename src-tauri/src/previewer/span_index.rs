use std::ops::Range;

use serde::{Deserialize, Serialize};
use ts_rs::TS;
use typst::WorldExt;
use typst_html::{HtmlDocument, HtmlNode};

use crate::{
    previewer::html_node::node_to_string,
    previewer::utf16::{Utf16Index, to_utf16_range},
    previewer::world::SimpleWorld,
};

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SpanIndex(Vec<(Range<Utf16Index>, String)>);

impl SpanIndex {
    pub fn new(world: &SimpleWorld, document: &HtmlDocument) -> Self {
        let mut entries = Vec::new();
        collect(world, document, document.root_node(), &mut entries);
        entries.sort_by_key(|(r, _)| (r.start, r.end));
        Self(
            entries
                .into_iter()
                .map(|(r, s)| {
                    (
                        to_utf16_range(world.main_source().text(), &r).expect("invalid range"),
                        s,
                    )
                })
                .collect(),
        )
    }
}

fn collect(
    world: &SimpleWorld,
    document: &HtmlDocument,
    node: &HtmlNode,
    out: &mut Vec<(Range<usize>, String)>,
) {
    if let Some(range) = world.range(node.span())
        && let Ok(string) = node_to_string(document, node)
    {
        out.push((range, string));
    }
    if let HtmlNode::Element(el) = node {
        for child in &el.children {
            collect(world, document, child, out);
        }
    }
}
