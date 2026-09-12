use serde::Deserialize;
use typst::{
    foundations::{Element, Selector},
    introspection::{Introspector, MetadataElem},
};
use typst_html::HtmlDocument;

use crate::previewer::world;

fn extract_first_metadata_from_world(
    world: &impl typst::World,
) -> Option<typst::foundations::Value> {
    let document: HtmlDocument = typst::compile(world).output.ok()?;
    let selector = Selector::Elem(Element::of::<MetadataElem>(), None);
    let matches = document.introspector().query(&selector);
    let first_match = matches.first()?;
    let metadata_elem = first_match.to_packed::<MetadataElem>()?;
    Some(metadata_elem.clone().value.clone())
}
pub fn extract_first_metadata<T: for<'a> Deserialize<'a>>(typst_content: &str) -> Option<T> {
    let mut world = world::SimpleWorld::new();
    let main_source = world.main_source_mut();
    main_source.replace(typst_content);
    let extracted = extract_first_metadata_from_world(&world)?;
    let json = serde_json::to_string(&extracted).ok()?;
    serde_json::from_str(&json).ok()
}
