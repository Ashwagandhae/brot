import type { PaletteId } from "../../src-tauri/bindings/PaletteId";
import type { PartialAction } from "../../src-tauri/bindings/PartialAction";
import type { PartialActionFilter } from "../../src-tauri/bindings/PartialActionFilter";
import {
  actions,
  type ActionRegistryManager,
  type ActionsKey,
  type ArgType,
  type ArgTypesMap,
  type ParsedPartialAction,
} from "./actions";
import { msg } from "./message";
import TextChecker from "./TextChecker.svelte";
import { withProps, type WithProps } from "./componentProps";
import {
  parseLangFromString,
  parseNumberFromString,
  parseUrlFromString,
} from "./parse";
import UnsupportedArg from "./UnsupportedArg.svelte";
import EnumChecker from "./EnumChecker.svelte";

export interface CommandProvider<T> {
  search: (
    search: string,
    start: number,
    end: number
  ) => Promise<CommandChoice<T>[]>;
  stop?: () => void;
}

export type CommandChoice<T> = {
  indices: Array<number>;
  title: string;
  icon: string | null;
  shortcut: string | null;
  payload: T;
  path: string | null;
};

export type PaletteType =
  | {
      type: "palette";
      key: string;
    }
  | {
      type: "arg";
      argType: ArgType;
      action: ParsedPartialAction;
    }
  | {
      type: "component";
      withProps: WithProps<{ onfinish: () => void }, "onfinish">;
    };

export function addArg<T extends keyof ArgTypesMap, K extends ActionsKey>(
  action: ParsedPartialAction<K>,
  arg: ArgTypesMap[T]
): ParsedPartialAction<K> {
  return {
    key: action.key,
    parsedArgs: [...action.parsedArgs, arg] as any,
  };
}

class PaletteCommandProvider implements CommandProvider<PartialAction> {
  id: PaletteId | null;
  key: string;
  filters: PartialActionFilter[];
  constructor(key: string, filters: PartialActionFilter[]) {
    this.id = null;
    this.key = key;
    this.filters = filters;
  }
  private async initId() {
    return await msg("createPalette", {
      paletteKey: this.key,
      filters: this.filters,
    });
  }
  private async searchPalette(
    search: string,
    id: PaletteId,
    start: number,
    end: number
  ) {
    return await msg("searchPalette", {
      search,
      id,
      start,
      end,
    });
  }
  async search(
    search: string,
    start: number,
    end: number
  ): Promise<CommandChoice<PartialAction>[]> {
    if (this.id == null) {
      this.id = await this.initId();
    }
    let res = await this.searchPalette(search, this.id, start, end);
    // if null, then id is invalid, so try reiniting
    if (res == null) {
      this.id = await this.initId();
      res = await this.searchPalette(search, this.id, start, end);
    }
    // if still null then we are cooked
    if (res == null) {
      return [];
    }
    return res.map((matched) => {
      let {
        indices,
        paletteAction: { title, icon, shortcut, action, path },
      } = matched;
      return { title, indices, icon, shortcut, payload: action, path };
    });
  }

  async stop(): Promise<void> {
    if (this.id == null) return;
    await msg("deletePalette", { id: this.id });
  }
}

type ArgPaletteMap = {
  [K in keyof ArgTypesMap]: WithProps<
    { onfinish: (arg: ArgTypesMap[K] | null) => void },
    "onfinish"
  >;
};

const argPaletteMap: ArgPaletteMap = {
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
};

export function paletteForArg<T extends ArgType>(
  argType: T
): WithProps<{ onfinish: (arg: ArgTypesMap[T] | null) => void }, "onfinish"> {
  return argPaletteMap[argType];
}

export function providerForPaletteKey(
  key: string,
  registry: ActionRegistryManager
) {
  return new PaletteCommandProvider(key, getFilters(registry));
}

function getFilters(registry: ActionRegistryManager): PartialActionFilter[] {
  return Object.entries(actions).flatMap(([key, _]) => {
    let typedKey = key as keyof typeof actions;
    let argsFilter = registry.getArgsFilter(typedKey);
    if (argsFilter == null) return [];
    return argsFilter().toFilters(key);
  });
}
