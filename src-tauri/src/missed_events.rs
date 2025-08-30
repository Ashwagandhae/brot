use std::collections::HashMap;

use anyhow::Result;
use tauri::{AppHandle, Emitter, EventTarget, State};

use crate::state::AppState;

#[derive(Debug, Clone)]
pub struct EventManager {
    window_states: HashMap<String, WindowEventState>,
    app: AppHandle,
}

#[tauri::command]
pub fn set_event_ready(window: tauri::Window, state: State<'_, AppState>) {
    state
        .event_manager
        .blocking_lock()
        .set_ready(window.label())
        .expect("failed to set ready");
}

impl EventManager {
    pub fn new(app: AppHandle) -> Self {
        Self {
            window_states: HashMap::new(),
            app,
        }
    }
    pub fn set_ready(&mut self, label: &str) -> Result<()> {
        let window_state = self.window_states.remove(label);
        let missed_events = match window_state {
            None => Vec::new(),
            Some(WindowEventState::Starting(events)) => events,
            Some(WindowEventState::Ready) => return Ok(()),
        };
        self.window_states
            .insert(label.to_owned(), WindowEventState::Ready);

        for event in missed_events {
            self.send_event_ready(label, event)?;
        }
        Ok(())
    }

    pub fn send_event(&mut self, label: &str, event: Event) -> Result<()> {
        println!("sending event to {label}");
        match self.window_states.get_mut(label) {
            None => {
                self.window_states.insert(
                    label.to_owned(),
                    WindowEventState::Starting(vec![event.clone()]),
                );
                println!("starting with new: [{event:?}]");
            }
            Some(WindowEventState::Starting(events)) => {
                events.push(event);
                println!("starting with: {events:?}");
            }
            Some(WindowEventState::Ready) => {
                self.send_event_ready(label, event.clone())?;
                println!("ready, sending directly: {event:?}");
            }
        }
        Ok(())
    }

    fn send_event_ready(&self, label: &str, event: Event) -> Result<()> {
        Ok(self
            .app
            .emit_to(EventTarget::webview_window(label), &event.0, ())?)
    }

    pub fn remove_window(&mut self, label: &str) {
        self.window_states.remove(label);
    }
}

#[derive(Debug, Clone)]
pub enum WindowEventState {
    Starting(Vec<Event>),
    Ready,
}

#[derive(Debug, Clone)]
pub struct Event(pub String);
