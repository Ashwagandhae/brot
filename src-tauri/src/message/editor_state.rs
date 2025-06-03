use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, TS, Clone, PartialEq, Eq)]
#[ts(export)]
pub struct EditorStates {
    pinned: HashMap<String, PinnedEditorState>,
    notes: HashMap<String, EditorState>,
}

#[derive(Serialize, Deserialize, TS, Clone, PartialEq, Eq)]
pub struct PinnedEditorState {
    pub folded: bool,
    pub note_state: EditorState,
}

#[derive(Serialize, Deserialize, TS, Clone, PartialEq, Eq)]
pub struct EditorState {
    pub selection: (usize, usize),
}
