use std::{collections::HashSet, sync::LazyLock};

use regex::Regex;

use crate::message::title::path_to_title;

pub struct TagNode {
    pub name: String,
    pub children: Vec<TagNode>,
}

impl TagNode {
    fn new(name: String) -> Self {
        Self {
            name,
            children: Vec::new(),
        }
    }
}

/// Turn a path like "-hello--there_my_name_-is_-joe--dan-iel--john.typ" -> [[hello, there], [is], [joe, dan-iel, john]]
#[derive(Debug, Clone)]
pub enum TitleWord {
    Content(String),
    Tag(Vec<String>),
}
pub fn parse_title_words(path: &str) -> Vec<TitleWord> {
    static TWO_OR_MORE_DASHES: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"-{2,}").unwrap());
    let re = &*TWO_OR_MORE_DASHES;
    path_to_title(path)
        .split_whitespace()
        .map(|s| {
            if s.starts_with('-') {
                TitleWord::Tag(
                    re.split(s.trim_start_matches('-'))
                        .map(|x| x.to_string())
                        .collect(),
                )
            } else {
                TitleWord::Content(s.to_string())
            }
        })
        .collect()
}
fn extract_tag_units(path: &str) -> Vec<Vec<String>> {
    parse_title_words(path)
        .into_iter()
        .filter_map(|word| match word {
            TitleWord::Tag(t) => Some(t),
            _ => None,
        })
        .collect()
}

pub fn tags_from_paths(paths: &HashSet<String>) -> Vec<TagNode> {
    let mut nodes: Vec<TagNode> = Vec::new();

    for path in paths.iter() {
        for tag_parts in extract_tag_units(path) {
            insert_tag_parts(&tag_parts, &mut nodes);
        }
    }

    nodes
}

fn insert_tag_parts(tag_parts: &[String], nodes: &mut Vec<TagNode>) {
    match tag_parts {
        [] => {}
        [head, tail @ ..] => {
            let index = nodes
                .iter()
                .position(|t| t.name == *head)
                .unwrap_or_else(|| {
                    nodes.push(TagNode::new(head.to_string()));
                    nodes.len() - 1
                });

            let child_tag_node = &mut nodes[index];
            insert_tag_parts(tail, &mut child_tag_node.children);
        }
    }
}

pub fn construct_all_tags(nodes: &[TagNode]) -> Vec<String> {
    nodes
        .iter()
        .flat_map(|node| {
            std::iter::once(format!("-{}", node.name))
                .chain(
                    construct_all_tags(&node.children)
                        .iter()
                        .map(|child| format!("-{}-{}", node.name, child)),
                )
                .collect::<Vec<_>>()
        })
        .collect()
}
