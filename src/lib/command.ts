import type { PartialAction } from "../../src-tauri/bindings/PartialAction";
import type { PartialActionFilter } from "../../src-tauri/bindings/PartialActionFilter";
import {
  actions,
  type ActionRegistryManager,
  type ActionsKey,
  type ArgType,
  type ParsedPartialAction,
} from "./actions";
import { msg } from "./message";
import { type WithProps } from "./componentProps";
import type { SearcherId } from "../../src-tauri/bindings/SearcherId";
import { type ArgTypesMap } from "./arg";
import { argPaletteMap } from "./argPaletteMap";

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
  id: SearcherId | null;
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
    id: SearcherId,
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
        payload: { title, icon, shortcut, action, path },
      } = matched;
      return { title, indices, icon, shortcut, payload: action, path };
    });
  }

  async stop(): Promise<void> {
    if (this.id == null) return;
    await msg("deletePalette", { id: this.id });
  }
}

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
