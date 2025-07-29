use regex::Regex;

pub fn path_to_title(path: &str) -> String {
    let path = path.replace("_", " ");
    path.strip_suffix(".md").unwrap_or(&path).to_string()
}

pub fn title_to_path(title: &str) -> String {
    let stem = sanitize_filename(title);
    format!("{}.md", stem)
}

fn sanitize_filename(input: &str) -> String {
    let re = Regex::new(r#"[\s<>:"/\\|?*\x00-\x1F]+"#).unwrap();
    let replaced = re.replace_all(input, "_");

    replaced.trim_matches('_').to_string()
}
