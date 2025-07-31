use message::{handle_message_and_errors, ClientMessage, ServerMessage};
use state::AppState;
use tauri::{AppHandle, Manager, State};

#[cfg(not(target_os = "android"))]
use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};

#[cfg(not(target_os = "android"))]
use window::{complete_search, open_search, open_window};

#[cfg(not(target_os = "android"))]
use window_state::update_window_state;

pub mod message;
pub mod server;
pub mod state;
pub mod window_state;

#[cfg(not(target_os = "android"))]
pub mod window;

#[tauri::command]
fn is_android() -> bool {
    #[cfg(not(target_os = "android"))]
    {
        false
    }

    #[cfg(target_os = "android")]
    {
        true
    }
}

#[tauri::command]
async fn message_command(
    message: ClientMessage,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<ServerMessage, String> {
    Ok(handle_message_and_errors(message, &state, Some(app)).await)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default().plugin(tauri_plugin_clipboard_manager::init());

    let app = app
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_android_fs::init())
        .setup(|app| {
            let state = AppState::new(app).expect("failed to init app state");
            app.manage(state.clone());
            // app.set_activation_policy(ActivationPolicy::Accessory);
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                std::thread::spawn(move || {
                    let sys = actix_rt::System::new();
                    sys.block_on(async {
                        if let Err(e) = server::run_server(state.clone()).await {
                            eprintln!("Actix server failed: {:?}", e);
                        }
                    });
                });
            }
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler({
            #[cfg(not(target_os = "android"))]
            {
                tauri::generate_handler![
                    message_command,
                    is_android,
                    open_window,
                    update_window_state,
                    complete_search
                ]
            }
            #[cfg(target_os = "android")]
            {
                tauri::generate_handler![message_command, is_android]
            }
        });

    let app = {
        #[cfg(not(target_os = "android"))]
        {
            app.plugin(tauri_plugin_shell::init()).plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_shortcuts([
                        "command+semicolon",
                        "command+quote",
                        "command+shift+semicolon",
                    ])
                    .expect("failed to set shortcuts")
                    .with_handler(|app, shortcut, event| {
                        let state = app.state::<AppState>();
                        if event.state == ShortcutState::Pressed {
                            if shortcut.matches(Modifiers::SUPER, Code::Semicolon) {
                                use crate::window::toggle_pinned;
                                toggle_pinned(app.clone(), state.clone());
                            }
                            if shortcut.matches(Modifiers::SUPER, Code::Quote) {
                                open_search(app.clone(), state.clone());
                            }
                            if shortcut
                                .matches(Modifiers::SUPER | Modifiers::SHIFT, Code::Semicolon)
                            {
                                use crate::message::locater::Locater;
                                open_window(app.clone(), state.clone(), Locater::New);
                            }
                        }
                    })
                    .build(),
            )
        }
        #[cfg(target_os = "android")]
        {
            app
        }
    };
    app.build(tauri::generate_context!())
        .expect("error building app")
        .run(|_app_handle, event| match event {
            tauri::RunEvent::ExitRequested { api, .. } => {
                api.prevent_exit();
            }
            _ => {}
        });
}
