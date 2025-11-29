<script lang="ts" generics="StoreType, InputType">
  import type { Component } from "svelte";
  import type { CheckerProps } from "./checker";
  import type { ParseResult } from "./parse";
  import type { WithProps } from "./componentProps";

  let {
    checker,
    onfinish,
    setVal,
    init,
    toVal,
    outputDisplay,
  }: {
    checker: WithProps<
      CheckerProps<StoreType, InputType>,
      "toVal" | "onfinish" | "init" | "outputDisplay"
    >;
    toVal: (text: InputType) => ParseResult<StoreType>;
    onfinish: () => void;
    init: InputType;
    setVal: (val: StoreType) => void;
    outputDisplay?: CheckerProps<StoreType, InputType>["outputDisplay"];
  } = $props();
  let Checker = checker.Component;
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
  {...checker.props}
></Checker>
