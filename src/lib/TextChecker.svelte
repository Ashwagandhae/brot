<script lang="ts" generics="T">
  import { stringToDom } from "htmlarkdown";
  import TextBar from "./TextBar.svelte";
  import type { ParseResult } from "./parse";
  import type { CheckerProps } from "./checker";

  let { onfinish, toVal, init }: CheckerProps<T, string> = $props();

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
<div class="out" class:ok={res.type == "ok"}>
  {#if res.type == "err"}
    err: {res.message}
  {:else if res.type == "ok"}
    {#if res.message}
      ok: {res.message}
    {:else}
      ok
    {/if}
  {/if}
</div>

<style>
  .out {
    width: 100%;
    font-size: 16px;
    height: 32px;
    line-height: 1;
    box-sizing: border-box;
    border-radius: 8px;
    background: var(--palette-back);
    padding: 8px;
  }
  .out.ok {
    background: var(--palette-select);
  }
</style>
