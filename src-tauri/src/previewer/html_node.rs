use comemo::Track;
use ecow::eco_format;
use typst::diag::SourceResult;
use typst_html::{HtmlDocument, HtmlNode, HtmlOptions, html_in_bundle};
use typst_library::model::LateLinkResolver;

pub fn node_to_string(document: &HtmlDocument, node: &HtmlNode) -> SourceResult<String> {
    match node {
        HtmlNode::Tag(_) => Ok(String::new()),
        HtmlNode::Text(text, _) => Ok(escape_text(text)),
        HtmlNode::Element(element) => {
            let resolver = LateLinkResolver::new(None, document.introspector().as_ref());
            let html = html_in_bundle(element, &HtmlOptions { pretty: false }, resolver.track())?;
            Ok(html
                .strip_prefix("<!DOCTYPE html>")
                .unwrap_or(&html)
                .to_string())
        }

        HtmlNode::Frame(frame) => {
            let resolver = LateLinkResolver::new(None, document.introspector().as_ref());
            Ok(typst_svg::svg_in_html(
                &frame.inner,
                frame.text_size,
                false,
                frame.id.as_deref(),
                &eco_format!("{}", frame.css.to_inline()),
                &frame.anchors,
                resolver.track(),
            ))
        }
    }
}

fn escape_text(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            _ => out.push(c),
        }
    }
    out
}
