import type { Locater } from "../../src-tauri/bindings/Locater";

export function locaterToUrl(locater: Locater): string {
  if (locater == "pinned") {
    return "/";
  } else if (locater == "settings") {
    return "/settings";
  } else if (locater == "new") {
    return "/new";
  } else {
    return "/note?p=" + locater.slice(5);
  }
}
