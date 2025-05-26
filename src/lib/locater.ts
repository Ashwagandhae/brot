import { getContext, setContext } from "svelte";
import type { Locater } from "../../src-tauri/bindings/Locater";
import type { Writable } from "svelte/store";

export function setLocaterContext(locater: Writable<Locater | null>) {
  setContext("locater", locater);
}

export function getLocaterContext(): Writable<Locater | null> {
  return getContext("locater");
}
