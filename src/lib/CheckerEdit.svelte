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
  }: {
    Checker: Component<CheckerProps<StoreType, InputType>>;
    toVal: (text: InputType) => ParseResult<StoreType>;
    onfinish: () => void;
    init: InputType;
    setVal: (val: StoreType) => void;
  } = $props();
</script>

<Checker
  {init}
  {toVal}
  onfinish={(out) => {
    if (out != null) {
      setVal(out);
    }
    onfinish();
    console.log("finished");
  }}
></Checker>
