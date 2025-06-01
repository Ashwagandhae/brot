import { getContext, setContext } from "svelte";
import type { ViewState } from "../../src-tauri/bindings/ViewState";
import type { Writable } from "svelte/store";
import type { Locater } from "../../src-tauri/bindings/Locater";

export function setViewStateContext(view_state: Writable<ViewState | null>) {
  setContext("view_state", view_state);
}

export function getViewStateContext(): Writable<ViewState | null> {
  return getContext("view_state");
}

export function toLocater(viewState: ViewState): Locater {
  switch (viewState.type) {
    case "Note":
      return `note:${viewState.path}`;
    case "Pinned":
      return "pinned";
    case "New":
      return "new";
    case "Settings":
      return "settings";
  }
}
