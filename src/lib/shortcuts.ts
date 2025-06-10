import type { Actions } from "../../src-tauri/bindings/Actions";
import type { PartialAction } from "../../src-tauri/bindings/PartialAction";

export function mapKeydownEventToAction(
  actions: Actions
): (event: KeyboardEvent) => PartialAction | null {
  let shortcuts = actions.shortcuts;
  return (event) => {
    let keys = [];
    if (event.ctrlKey) keys.push("ctrl");
    if (event.metaKey) keys.push("meta");
    if (event.shiftKey) keys.push("shift");
    if (event.altKey) keys.push("alt");
    keys.push(event.key.toLowerCase());
    let keyString = keys.join(" ");
    if (keyString in shortcuts) {
      return shortcuts[keyString]!;
    }
    return null;
  };
}
