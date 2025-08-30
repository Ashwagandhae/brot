<script lang="ts" generics="StoreType, InputType">
  import type { Component } from "svelte";
  import type { CheckerProps } from "./checker";
  import type { ParseResult } from "./parse";

  let {
    Checker,
    onfinish,
    setVal,
    init,
    toVal,
    outputDisplay,
  }: {
    Checker: Component<CheckerProps<StoreType, InputType>>;
    toVal: (text: InputType) => ParseResult<StoreType>;
    onfinish: () => void;
    init: InputType;
    setVal: (val: StoreType) => void;
    outputDisplay?: CheckerProps<StoreType, InputType>["outputDisplay"];
  } = $props();
</script>

<Checker
  {init}
  {toVal}
  {outputDisplay}
  onfinish={(out) => {
    if (out != null) {
      setVal(out);
    }
    onfinish();
  }}
></Checker>
