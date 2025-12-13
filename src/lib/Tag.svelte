<script lang="ts">
  import BoldChars from "./BoldChars.svelte";
  import { getPartConfigKeys, type Range, type TagPartNode } from "./path";
  import { getTagConfigsContext } from "./tagConfig";

  let {
    parts,
    range,
    startPadding,
    indices,
    level,
  }: {
    parts: TagPartNode[];
    range: Range;
    startPadding: number;
    indices: number[] | undefined;
    level: number;
  } = $props();

  let tagConfigs = getTagConfigsContext();

  let partConfigs = $derived(
    getPartConfigKeys(parts).map((x) => tagConfigs()[x])
  );

  let partColors = $derived.by(() => {
    let hues: (number | undefined)[] = [];
    for (let config of partConfigs) {
      hues.push(config?.hue ?? hues.at(-1)); // inherit parent's hue if don't have one
    }
    return hues.map((hue) => {
      if (hue == null) return { hue: 0, chroma: 0 };
      return { hue, chroma: 0.085 };
    });
  });

  function atLeastOneBold(
    indices: number[] | undefined,
    offset: number,
    content: string
  ): boolean {
    if (indices == null) return false;
    return (
      indices.find((i) => i >= offset && i <= offset + content.length) != null
    );
  }
</script>

<span class="tag" style="--lightness: var(--level-{level + 1})">
  {#each parts as part, i}
    {@const offset =
      range.from + startPadding + part.range.from + part.startPadding}
    <span
      class="tagPart"
      style="--hue: {partColors[i].hue}; --chroma: {partColors[i].chroma}"
    >
      {#if partConfigs[i]?.abbreviation != null}
        <span class:bold={atLeastOneBold(indices, offset, part.content)}>
          {partConfigs[i].abbreviation}
        </span>
      {:else}
        <BoldChars
          text={part.content.replaceAll("-", " ")}
          indices={indices ?? []}
          {offset}
        ></BoldChars>
      {/if}
    </span>
  {/each}
</span>

<style>
  .tagPart {
    /* background: hsla(0, 0%, 100%, 0.15); */
    /* --level: 0.3; */
    background: oklch(var(--lightness) var(--chroma) var(--hue));
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

  .bold {
    font-weight: bold;
  }
</style>
