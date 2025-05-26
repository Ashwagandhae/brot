use tauri::{AppHandle, Manager, WebviewWindowBuilder, Wry};

#[tauri::command]
pub fn open_pinned(app: AppHandle) {
    let windows = app.webview_windows();
    let pinned_window = windows.get("pinned");
    if let Some(pinned_window) = pinned_window {
        if pinned_window.is_focused().unwrap() && pinned_window.is_visible().unwrap() {
            pinned_window.hide().unwrap();
        } else {
            pinned_window.show().unwrap();
            pinned_window.set_focus().unwrap();
        }
    } else {
        tauri::webview::WebviewWindowBuilder::new(
            &app,
            "pinned",
            tauri::WebviewUrl::App("/".into()),
        )
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true)
        .visible_on_all_workspaces(true)
        .always_on_top(true)
        .build()
        .unwrap();
    }
}
fn sanitize_window_label(input: &str) -> String {
    input
        .to_ascii_lowercase()
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim_matches('_') // remove leading/trailing underscores
        .to_string()
}

#[tauri::command]
pub fn open_note(app: AppHandle, path: String) {
    basic_window(
        &app,
        unique_label(&app, sanitize_window_label(&format!("note_{path}"))),
        format!("/note?p={path}"),
    )
    .build()
    .unwrap();
}
#[tauri::command]
pub fn open_settings(app: AppHandle) {
    basic_window(
        &app,
        unique_label(&app, "settings".to_owned()),
        "/settings".to_owned(),
    )
    .build()
    .unwrap();
}
#[tauri::command]
pub fn open_new(app: AppHandle) {
    basic_window(
        &app,
        unique_label(&app, "new".to_owned()),
        "/new".to_owned(),
    )
    .build()
    .unwrap();
}

fn unique_label(app: &AppHandle, label: String) -> String {
    let mut ret_label = label.clone();
    let mut i = 1;
    while app.webview_windows().get(&ret_label).is_some() {
        ret_label = format!("{label}_{i}");
        i += 1;
    }
    ret_label
}

fn basic_window(
    app: &AppHandle,
    label: String,
    url: String,
) -> WebviewWindowBuilder<'_, Wry, AppHandle> {
    tauri::webview::WebviewWindowBuilder::new(app, label, tauri::WebviewUrl::App(url.into()))
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true)
}
