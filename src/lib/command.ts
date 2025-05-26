import type { Writable } from "svelte/store";
import type { Command } from "../../src-tauri/bindings/Command";
import { getContext, setContext } from "svelte";
import type { Insertion } from "../../src-tauri/bindings/Insertion";

export type CommandProvider = (search: string) => Promise<Command[]>;

export type CommandPaletteState = {
  provider: CommandProvider;
} | null;

export type ActionRegistry = {
  editTitle?: () => void;
  addPinned?: (path: string, insertion: Insertion) => Promise<void>;
  removePinned?: () => Promise<void>;
  currentTitle?: () => string | null;
};
export function setActionRegistryContext(registry: Writable<ActionRegistry>) {
  setContext("actionRegistry", registry);
}
export function getActionRegistryContext(): Writable<ActionRegistry> {
  return getContext("actionRegistry");
}
