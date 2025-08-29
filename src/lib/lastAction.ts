import type { PartialAction } from "../../src-tauri/bindings/PartialAction";
import type { ParsedPartialAction } from "./actions";

let lastAction: ParsedPartialAction | null = null;
export function setLastAction(action: ParsedPartialAction) {
  if (action.key == "repeatLastAction") return;
  lastAction = action;
}

export function runLastAction(runner: (action: ParsedPartialAction) => void) {
  if (lastAction == null) return null;
  console.log("last action: ", lastAction);
  runner(lastAction);
}
