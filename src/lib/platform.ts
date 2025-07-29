import { invoke } from "@tauri-apps/api/core";
import { writable, type Writable } from "svelte/store";

let platformName: "tab" | "window" | "android" | null = null;

export type Platform = "tab" | "window" | "android" | null;

async function getPlatformName() {
  if (!isTauri()) {
    platformName = "tab";
  } else if (await invoke("is_android")) {
    platformName = "android";
  } else {
    platformName = "window";
  }
  return platformName;
}

export function isTauri(): boolean {
  return !!(window as unknown as any).__TAURI_INTERNALS__;
}

export let platform: Writable<Platform> = writable(null);

export async function initPlatformName() {
  platform.set(await getPlatformName());
}
