import { getContext, setContext } from "svelte";
import type { Writable } from "svelte/store";
import type { Locater } from "../../src-tauri/bindings/Locater";

export type ViewState =
  | { type: "note"; path: string }
  | { type: "pinned"; focusPath: string | null }
  | { type: "settings" }
  | { type: "new" };

export function setViewStateContext(viewState: Writable<ViewState | null>) {
  setContext("viewState", viewState);
}

export function getViewStateContext(): Writable<ViewState | null> {
  return getContext("viewState");
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
