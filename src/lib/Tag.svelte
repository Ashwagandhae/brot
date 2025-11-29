<script lang="ts">
  import BoldChars from "./BoldChars.svelte";
  import type { Range, TagPartNode } from "./path";
  import { getTagConfigsContext } from "./tagConfig";

  let {
    parts,
    range,
    startPadding,
    indices,
  }: {
    parts: TagPartNode[];
    range: Range;
    startPadding: number;
    indices: number[] | undefined;
  } = $props();

  let tagConfigs = getTagConfigsContext();

  let partKeys = $derived.by(() => {
    let curr = "";
    let res = [];
    for (let part of parts) {
      curr += part.content;
      res.push(curr);
      curr += "--";
    }
    return res;
  });

  let partConfigs = $derived(partKeys.map((x) => tagConfigs()[x]));

  let partHues = $derived(
    partConfigs.map((config) => {
      let hue = config?.hue;
      if (hue == null) return { hue: 0, chroma: 0 };
      return { hue, chroma: 0.2 };
    })
  );
</script>

<span class="tag">
  {#each parts as part, i}
    <span
      class="tagPart"
      style="--hue: {partHues[i].hue}; --chroma: {partHues[i].chroma}"
    >
      <BoldChars
        text={part.content.replaceAll("-", " ")}
        indices={indices ?? []}
        offset={range.from + startPadding + part.range.from + part.startPadding}
      ></BoldChars>
    </span>
  {/each}
</span>

<style>
  .tagPart {
    /* background: hsla(0, 0%, 100%, 0.15); */
    background: oklch(0.5 var(--chroma) var(--hue) / 0.4);
    padding: var(--padding-vertical) 2px;
    line-height: 1;
    display: flex;
    flex-direction: row;
    align-items: center;
    border-radius: var(--radius-small);
    white-space: nowrap;
  }
  .tagPart:first-child {
    border-radius: var(--radius-big) var(--radius-small) var(--radius-small)
      var(--radius-big);
    padding: var(--padding-vertical) 2px var(--padding-vertical) 4px;
  }
  .tagPart:last-child {
    border-radius: var(--radius-small) var(--radius-big) var(--radius-big)
      var(--radius-small);
    padding: var(--padding-vertical) 4px var(--padding-vertical) 2px;
  }
  .tagPart:only-child {
    border-radius: var(--radius-big) var(--radius-big) var(--radius-big)
      var(--radius-big);
    padding: var(--padding-vertical) 4px var(--padding-vertical) 4px;
  }

  .tag {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 3px;
  }
</style>
