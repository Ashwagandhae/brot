import { actions } from "./actions";
import type { ArgPaletteMap } from "./arg";
import { withProps } from "./componentProps";
import EnumChecker from "./EnumChecker.svelte";
import LatexOutputDisplay from "./LatexOutputDisplay.svelte";
import {
  parseLangFromString,
  parseLatexRenderFromString,
  parseNumberFromString,
  parseUrlFromString,
  type LatexRender,
} from "./parse";
import TextChecker from "./TextChecker.svelte";
import UnsupportedArg from "./UnsupportedArg.svelte";

export const argPaletteMap: ArgPaletteMap = {
  url: withProps(TextChecker<URL>, {
    toVal: parseUrlFromString,
  }),
  boolean: withProps(EnumChecker<boolean>, {
    choices: [
      { title: "true", payload: true },
      { title: "false", payload: false },
    ],
  }),
  number: withProps(TextChecker<number>, {
    toVal: parseNumberFromString,
  }),
  insertion: withProps(EnumChecker<"above" | "below">, {
    choices: [
      { title: "above", payload: "above" },
      { title: "below", payload: "below" },
    ],
  }),
  palette: withProps(EnumChecker<string>, {
    choices: Object.keys(actions).map((key) => ({ title: key, payload: key })),
  }),
  level: withProps(EnumChecker<1 | 2 | 3 | 4 | 5 | 6>, {
    choices: [
      { title: "1", payload: 1 },
      { title: "2", payload: 2 },
      { title: "3", payload: 3 },
      { title: "4", payload: 4 },
      { title: "5", payload: 5 },
      { title: "6", payload: 6 },
    ],
  }),
  locater: withProps(UnsupportedArg<"locater">, { argType: "locater" }),
  notePath: withProps(UnsupportedArg<"notePath">, { argType: "notePath" }),
  lang: withProps(TextChecker<string>, { toVal: parseLangFromString }),
  latex: withProps(TextChecker<LatexRender>, {
    toVal: parseLatexRenderFromString,
    outputDisplay: withProps(LatexOutputDisplay, {}),
  }),
};
