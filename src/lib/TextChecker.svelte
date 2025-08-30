<script lang="ts" generics="T">
  import { stringToDom } from "htmlarkdown";
  import TextBar from "./TextBar.svelte";
  import type { ParseResult } from "./parse";
  import type { CheckerProps } from "./checker";
  import PaletteOutput from "./PaletteOutput.svelte";
  import Icon from "./Icon.svelte";

  let { onfinish, toVal, init, outputDisplay }: CheckerProps<T, string> =
    $props();

  let text: string = $state(init ?? "");

  let res: ParseResult<T> = $derived.by(() => {
    return toVal(text);
  });
</script>

<TextBar
  bind:value={text}
  autofocus
  flat
  oncancel={() => onfinish(null)}
  onaccept={() => {
    let res = toVal(text);
    if (res.type == "err") {
      onfinish(null);
    } else {
      onfinish(res.val);
    }
  }}
></TextBar>
<PaletteOutput selected={res.type == "ok"}>
  <div class="icon">
    <Icon name={res.type == "ok" ? "check" : "x"}></Icon>
  </div>
  <div class="text">
    {#if res.type == "err"}
      {res.message}
    {:else if res.type == "ok"}
      {#if outputDisplay}
        {@const { Component, props } = outputDisplay}
        <Component {...props} val={res.val} message={res.message}></Component>
      {:else if res.message}
        {res.message}
      {:else}
        ok
      {/if}
    {/if}
  </div>
</PaletteOutput>

<style>
  .icon {
    width: 16px;
    height: 16px;
    padding: 8px;
    flex: 0 0 auto;
  }
  .text {
    flex: 1 1 auto;
    min-width: 0;
    white-space: normal;
    overflow-wrap: break-word;
    padding: 6px 8px 6px 0;
    line-height: 1.25;
    text-align: left;
  }
</style>
