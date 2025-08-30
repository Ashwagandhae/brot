import type { WithProps } from "./componentProps";
import type { ParseResult } from "./parse";

export type CheckerProps<StoreType, InputType> = {
  onfinish: (out: StoreType | null) => void;
  toVal: (input: InputType) => ParseResult<StoreType>;
  init?: InputType;
  outputDisplay?: WithProps<
    { val: StoreType; message?: string },
    "val" | "message"
  >;
};
