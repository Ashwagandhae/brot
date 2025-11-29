import type { Matched } from "../../src-tauri/bindings/Matched";
import type { SearcherId } from "../../src-tauri/bindings/SearcherId";
import { msg } from "./message";

export interface SuggestionProvider {
  search: (text: string, caret: number) => Promise<Suggestion[]>;
  stop?: () => void;
}

export interface Suggestion {
  indices: number[];
  display: string;
  replace: () => { text: string; caret: number };
}

export class TagSuggestionProvider implements SuggestionProvider {
  id: SearcherId | null;
  constructor() {
    this.id = null;
  }
  private async initId() {
    return await msg("createSuggester", {
      suggesterSource: { type: "tag" },
    });
  }
  private async searchPalette(search: string, id: SearcherId) {
    return await msg("searchSuggester", {
      search,
      id,
    });
  }

  async search(text: string, caret: number): Promise<Suggestion[]> {
    if (this.id == null) {
      this.id = await this.initId();
    }

    let wordRange = getCurrentWord(text, caret);
    if (wordRange == null) {
      console.log("retruned empty one");
      return [];
    }

    let { start, end } = wordRange;
    console.log("starting char: ", text.charAt(start), text);
    if (text.charAt(start) != "-") return [];

    let search = text.substring(start, end);

    let res = await this.searchPalette(search, this.id);
    // if null, then id is invalid, so try reiniting
    if (res == null) {
      this.id = await this.initId();
      res = await this.searchPalette(search, this.id);
    }
    // if still null then we are cooked
    if (res == null) {
      return [];
    }

    return res.map((matched) => {
      let {
        indices,
        payload: { value },
      } = matched;
      return {
        indices,
        display: value,
        replace: () => {
          return {
            text: text.substring(0, start) + value + text.substring(end),
            caret: start + value.length,
          };
        },
      };
    });
  }

  async stop(): Promise<void> {
    if (this.id == null) return;
    await msg("deleteSuggester", { id: this.id });
  }
}

function getCurrentWord(
  text: string,
  caret: number
): { start: number; end: number } | null {
  if (caret <= 0) return null;
  let start = caret;
  let end = caret;
  console.log(caret);
  console.log(
    "[" + text.charAt(start - 1) + "]",
    text.charAt(start - 1) == " "
  );
  if (text.charAt(start - 1) == " ") return null;
  while (start - 1 >= 0 && text.charAt(start - 1) != " ") {
    start--;
  }

  return {
    start,
    end,
  };
}
