import { getContext, setContext } from "svelte";
import type { Writable } from "svelte/store";
import type { Locater } from "../../src-tauri/bindings/Locater";

export type ViewState =
  | { type: "note"; path: string }
  | { type: "pinned"; focusPath: string | null }
  | { type: "settings" }
  | { type: "new" };

export function setViewStateContext(view_state: Writable<ViewState | null>) {
  setContext("view_state", view_state);
}

export function getViewStateContext(): Writable<ViewState | null> {
  return getContext("view_state");
}

export function toLocater(viewState: ViewState): Locater {
  switch (viewState.type) {
    case "note":
      return `note:${viewState.path}`;
    case "pinned":
      return "pinned";
    case "new":
      return "new";
    case "settings":
      return "settings";
  }
}
