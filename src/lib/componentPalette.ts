import {
  getContext,
  setContext,
  type SvelteComponent,
  type Component,
  type ComponentProps,
} from "svelte";
import type { WithProps } from "./componentProps";

export type OpenComponentPalette = (
  withProps: WithProps<
    {
      onfinish: () => void;
    },
    "onfinish"
  >
) => void;

export function setComponentPaletteContext(
  context: () => OpenComponentPalette
) {
  setContext("snippetPaletteContext", context);
}

export function getComponentPaletteContext(): () => OpenComponentPalette {
  return getContext("snippetPaletteContext");
}
