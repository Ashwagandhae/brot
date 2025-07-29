use std::ffi::CString;
use std::str::FromStr;

use objc2::rc::autoreleasepool;
use tauri::{
    AppHandle, Emitter, EventTarget, LogicalPosition, Manager, PhysicalPosition, PhysicalSize,
    State, WebviewWindow,
};

use crate::{message::locater::Locater, state::AppState};

fn unique_label(app: &AppHandle, label: String) -> String {
    let mut ret_label = label.clone();
    let mut i = 1;
    while app.webview_windows().get(&ret_label).is_some() {
        ret_label = format!("{label}_{i}");
        i += 1;
    }
    ret_label
}

use objc2::runtime::AnyObject;
use objc2::{msg_send, runtime::AnyClass};
use objc2_foundation::NSString;

fn get_frontmost_app_bundle_id() -> Option<String> {
    let ret = unsafe {
        autoreleasepool(|_| {
            let workspace_class = AnyClass::get(&CString::from_str(&"NSWorkspace").unwrap())?;
            let workspace: *mut AnyObject = msg_send![workspace_class, sharedWorkspace];
            if workspace.is_null() {
                return None;
            }

            let front_app: *mut AnyObject = msg_send![workspace, frontmostApplication];
            if front_app.is_null() {
                return None;
            }

            let ns_bundle_id: *mut AnyObject = msg_send![front_app, bundleIdentifier];
            if ns_bundle_id.is_null() {
                return None;
            }

            let ns_str_ptr: *mut AnyObject = ns_bundle_id as *mut AnyObject;

            // Cast to a reference to NSString (borrowed, no ownership change)
            let ns_string: &NSString = &*(ns_str_ptr as *const NSString);

            Some(ns_string.to_string())
        })
    };
    println!("frontmost app id: {ret:?}");
    ret
}

fn focus_app_by_bundle_id(bundle_id: &str) -> bool {
    println!("focusing app id: {bundle_id}");

    unsafe {
        autoreleasepool(|_| {
            // your existing unsafe code

            let ns_bundle_id = NSString::from_str(bundle_id);
            let running_apps_class =
                AnyClass::get(&CString::from_str(&"NSRunningApplication").unwrap()).unwrap();

            let apps: *mut AnyObject = msg_send![running_apps_class, runningApplicationsWithBundleIdentifier: &*ns_bundle_id];

            if apps.is_null() {
                return false;
            }

            let count: usize = msg_send![apps, count];
            if count == 0 {
                return false;
            }

            let app: *mut AnyObject = msg_send![apps, objectAtIndex: 0usize];

            // NSApplicationActivateIgnoringOtherApps = 1 << 1 = 2
            let activated: bool = msg_send![app, activateWithOptions: 2];
            activated
        })
    }
}

#[tauri::command]
pub fn toggle_pinned(app: AppHandle, state: State<'_, AppState>) {
    let windows = app.webview_windows();
    let pinned_window = windows.get("pinned");

    // if window pinned window is not focused, record which other window is focused
    if !pinned_window.is_some_and(|window| window.is_focused().unwrap()) {
        let mut last_focused_app_name = state.last_focused_app_name.blocking_lock();
        *last_focused_app_name = get_frontmost_app_bundle_id();
    }
    if let Some(pinned_window) = pinned_window {
        if pinned_window.is_focused().unwrap() && pinned_window.is_visible().unwrap() {
            pinned_window.hide().unwrap();
            let last_focused_app_name = state.last_focused_app_name.blocking_lock();
            if let Some(name) = &*last_focused_app_name {
                focus_app_by_bundle_id(name);
            }
        } else {
            pinned_window.show().unwrap();
            pinned_window.set_focus().unwrap();
        }
    } else {
        open_and_get_window(app, state, Locater::Pinned);
    }
}

#[tauri::command]
pub fn open_window(app: AppHandle, state: State<'_, AppState>, locater: Locater) {
    open_and_get_window(app, state, locater);
}

#[cfg(target_os = "macos")]
fn hide_traffic_lights(window: &tauri::WebviewWindow) {
    use objc2_app_kit::NSWindow;
    use objc2_app_kit::NSWindowButton;

    unsafe {
        use objc2::rc::Retained;
        use objc2_app_kit::NSButton;
        let ns_window_ptr = window.ns_window().expect("Failed to get NSWindow");

        let ns_window: &NSWindow = &*(ns_window_ptr as *mut NSWindow);

        let close: Option<Retained<NSButton>> =
            ns_window.standardWindowButton(NSWindowButton::CloseButton);
        let minimize: Option<Retained<NSButton>> =
            ns_window.standardWindowButton(NSWindowButton::MiniaturizeButton);
        let zoom: Option<Retained<NSButton>> =
            ns_window.standardWindowButton(NSWindowButton::ZoomButton);

        if let Some(button) = close {
            button.setHidden(true);
        }
        if let Some(button) = minimize {
            button.setHidden(true);
        }
        if let Some(button) = zoom {
            button.setHidden(true);
        }
    }
}

pub fn open_and_get_window(
    app: AppHandle,
    state: State<'_, AppState>,
    locater: Locater,
) -> WebviewWindow {
    let windows = app.webview_windows();
    let window = windows.values().find(|window| {
        Locater::from_url(&window.url().expect("failed to get window url"))
            .is_some_and(|other_locater| other_locater == locater)
    });
    if let Some(window) = window {
        window.show().unwrap();
        window.set_focus().unwrap();
        return window.clone();
    }
    let mut builder = tauri::webview::WebviewWindowBuilder::new(
        &app,
        if locater == Locater::Pinned {
            "pinned".to_owned()
        } else {
            unique_label(&app, "window".to_owned())
        },
        tauri::WebviewUrl::App(locater.into_path()),
    )
    .title_bar_style(tauri::TitleBarStyle::Overlay)
    .hidden_title(true);

    if let Locater::Pinned = &locater {
        builder = builder.visible_on_all_workspaces(true);
    }

    let settings = state.settings.blocking_lock();
    let window_state = settings
        .window_states
        .get(&locater)
        .cloned()
        .unwrap_or_default();
    let window = builder.build().unwrap();
    hide_traffic_lights(&window);
    window
        .set_size(PhysicalSize::new(window_state.width, window_state.height))
        .unwrap();
    window
        .set_position(PhysicalPosition::new(window_state.x, window_state.y))
        .unwrap();
    window.set_always_on_top(window_state.floating).unwrap();
    window.show().unwrap();
    window.set_focus().unwrap();

    window.clone()
}

pub fn open_search(app: AppHandle, state: State<'_, AppState>) {
    let windows = app.clone().webview_windows();
    let pinned_window = windows.get("pinned");

    let last_focused_app_name = get_frontmost_app_bundle_id();
    let (pinned_window_state, window) = match pinned_window {
        Some(pinned_window) => {
            if pinned_window.is_focused().unwrap() {
                (PinnedWindowState::Focused, pinned_window.clone())
            } else {
                let visible = pinned_window.is_visible().unwrap();
                pinned_window.show().unwrap();
                pinned_window.set_focus().unwrap();
                (
                    PinnedWindowState::Unfocused {
                        visible,
                        last_focused_app_name,
                    },
                    pinned_window.clone(),
                )
            }
        }
        None => {
            let window = open_and_get_window(app, state.clone(), Locater::Pinned);

            (
                PinnedWindowState::Unfocused {
                    visible: false,
                    last_focused_app_name,
                },
                window,
            )
        }
    };
    *state.pinned_state_before_search.blocking_lock() = pinned_window_state;
    window
        .emit_to(EventTarget::window("pinned"), "search", ())
        .expect("failed to send search event");
}

#[tauri::command]
pub fn complete_search(app: AppHandle, state: State<'_, AppState>, accepted: bool) {
    let windows = app.clone().webview_windows();
    let Some(pinned_window) = windows.get("pinned") else {
        return;
    };
    let pinned_window_state = state.pinned_state_before_search.blocking_lock().clone();
    match pinned_window_state {
        PinnedWindowState::Focused => {
            if !accepted {
                pinned_window.set_focus().unwrap()
            }
        }
        PinnedWindowState::Unfocused {
            visible,
            last_focused_app_name,
        } => {
            if !visible {
                pinned_window.hide().unwrap();
            }
            if !accepted {
                if let Some(bundle_id) = last_focused_app_name {
                    focus_app_by_bundle_id(&bundle_id);
                }
            }
        }
    }
}

#[derive(Debug, Clone)]
pub enum PinnedWindowState {
    Focused,
    Unfocused {
        visible: bool,
        last_focused_app_name: Option<String>,
    },
}
