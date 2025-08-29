import type { Component, ComponentProps, Snippet } from "svelte";
import type { MatchedPaletteAction } from "../../src-tauri/bindings/MatchedPaletteAction";
import type { PaletteAction } from "../../src-tauri/bindings/PaletteAction";
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
import { parseUrlFromString } from "./parse";

export interface CommandProvider {
  search: (
    search: string,
    start: number,
    end: number
  ) => Promise<MatchedPaletteAction[]>;
  stop?: () => void;
}

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
      Component: Component<{ onfinish: () => void }>;
      props: Record<string, any>;
    };

// function getParamActions(
//   search: string,
//   argType: ArgType,
//   action: PartialAction
// ): PaletteAction[] {
//   switch (argType) {
//     case "boolean":
//       return enumPaletteActions(["true", "false"], search, action);
//     case "insertion":
//       return enumPaletteActions(["above", "below"], search, action);
//     case "url":
//       return verifyActions(
//         (str) => {
//           try {
//             new URL(str);
//             return true;
//           } catch {
//             try {
//               new URL("http://" + str);
//               return true;
//             } catch {
//               return false;
//             }
//           }
//         },
//         search,
//         action
//       );
//     case "number":
//       return verifyActions(
//         (str) => {
//           return str.trim() !== "" && !isNaN(Number(str));
//         },
//         search,
//         action
//       );
//     case "locater":
//       return [];
//     case "notePath":
//       return [];
//     case "palette":
//       return [];
//     case "level":
//       return enumPaletteActions(["1", "2", "3", "4", "5", "6"], search, action);
//   }
// }

// function verifyActions(
//   verify: (search: string) => boolean,
//   search: string,
//   action: PartialAction
// ): PaletteAction[] {
//   if (verify(search)) {
//     return [
//       {
//         title: "ok",
//         icon: "check",
//         action: addArg(action, search),
//         shortcut: null,
//       },
//     ];
//   }
//   return [];
// }

// function enumPaletteActions(
//   choices: string[],
//   search: string,
//   action: PartialAction
// ): PaletteAction[] {
//   return choices
//     .filter((choice) => choice.includes(search))
//     .map((choice) => {
//       return {
//         title: choice,
//         icon: null,
//         action: addArg(action, choice),
//         shortcut: null,
//       };
//     });
// }

export function addArg<T extends keyof ArgTypesMap, K extends ActionsKey>(
  action: ParsedPartialAction<K>,
  arg: ArgTypesMap[T]
): ParsedPartialAction<K> {
  return {
    key: action.key,
    parsedArgs: [...action.parsedArgs, arg] as any,
  };
}

class PaletteCommandProvider implements CommandProvider {
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
  ): Promise<MatchedPaletteAction[]> {
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
    return res;
  }

  async stop(): Promise<void> {
    if (this.id == null) return;
    await msg("deletePalette", { id: this.id });
  }
}

export function paletteForArg(
  argType: ArgType,
  action: ParsedPartialAction
): WithProps<{ onfinish: (arg: any | null) => void }, "onfinish"> {
  switch (argType) {
    case "boolean":
      // return enumPaletteActions(["true", "false"], search, action);
      return [] as any;
    case "insertion":
      // return enumPaletteActions(["above", "below"], search, action);
      return [] as any;

    case "url":
      return withProps(TextChecker<URL>, {
        toVal: parseUrlFromString,
        init: "",
      });

    case "number":
      // return verifyActions(
      //   (str) => {
      //     return str.trim() !== "" && !isNaN(Number(str));
      //   },
      //   search,
      //   action
      // );
      return [] as any;

    case "locater":
      return [] as any;
    case "notePath":
      return [] as any;
    case "palette":
      return [] as any;
    case "level":
      return [] as any;
  }
  throw new Error(`unknow arg type ${argType}`);
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
