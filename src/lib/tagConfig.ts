import { getContext, setContext } from "svelte";
import type { TagConfig } from "../../src-tauri/bindings/TagConfig";

export type TagConfigs = { [x: string]: TagConfig | undefined };

export function setTagConfigsContext(context: () => TagConfigs) {
  setContext("tagConfigs", context);
}

export function getTagConfigsContext(): () => TagConfigs {
  return getContext("tagConfigs");
}
