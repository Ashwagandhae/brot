import type { Writable } from "svelte/store";
import type { Command } from "../../src-tauri/bindings/Command";
import { getContext, setContext } from "svelte";
import type { Insertion } from "../../src-tauri/bindings/Insertion";
import type { Editor } from "@tiptap/core";

export type CommandProvider = (search: string) => Promise<Command[]>;

export type CommandPaletteState = {
  provider: CommandProvider;
} | null;

export type ActionRegistry = {
  note?: NoteActionRegistry;
  addPinned?: (path: string, insertion: Insertion) => Promise<void>;
  removePinned?: () => Promise<void>;
  refresh?: () => Promise<void>;
};

type EditorActions = "bold";

export type EditorActionsRegistry = Partial<Record<EditorActions, () => void>>;

export type NoteActionRegistry = {
  currentTitle?: () => string | null;
  editTitle?: () => void;
  toggleMinimized?: () => void;
  editor?: Editor;
  save?: () => void;
  editorAction?: EditorActionsRegistry;
};
export function setActionRegistryContext(registry: Writable<ActionRegistry>) {
  setContext("actionRegistry", registry);
}
export function getActionRegistryContext(): Writable<ActionRegistry> {
  return getContext("actionRegistry");
}
