import type { PartialAction } from "../../src-tauri/bindings/PartialAction";

let lastAction: PartialAction | null = null;
export function setLastAction(action: PartialAction) {
  if (action.key == "repeatLastAction") return;
  lastAction = action;
}

export function runLastAction(runner: (action: PartialAction) => void) {
  if (lastAction == null) return null;
  console.log("last action: ", lastAction);
  runner(lastAction);
}
