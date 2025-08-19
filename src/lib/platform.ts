import { invoke } from "@tauri-apps/api/core";
import { writable, type Writable } from "svelte/store";
import type { Locater } from "../../src-tauri/bindings/Locater";
import { locaterToUrl } from "./locater";

let $platform: "tab" | "window" | "android" | null = null;

export type Platform = "tab" | "window" | "android" | null;

export async function getPlatformName() {
  if (!isTauri()) {
    $platform = "tab";
  } else if (await invoke("is_android", {})) {
    $platform = "android";
  } else {
    $platform = "window";
  }
  return $platform;
}

export function isTauri(): boolean {
  return !!(window as unknown as any).__TAURI_INTERNALS__;
}

export let platform: Writable<Platform> = writable(null);

export async function openExternal(locater: Locater) {
  if ($platform == "tab") {
    window.open(locaterToUrl(locater), "_blank");
  } else {
    invoke("open_window", { locater });
  }
}

export async function updateWindowState(locater: Locater) {
  if ($platform == "tab") return;
  invoke("update_window_state", { locater });
}

export async function sendCompleteSearch(accepted: boolean) {
  if ($platform == "tab") return;
  await invoke("complete_search", { accepted });
}
