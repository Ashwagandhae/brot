<script lang="ts">
  import BoldChars from "./BoldChars.svelte";
  import { pathToTitleNodes } from "./path";
  import Tag from "./Tag.svelte";
  import { getTagConfigsContext } from "./tagConfig";

  let { path, indices }: { path: string; indices?: number[] } = $props();

  let nodes = $derived(pathToTitleNodes(path));
</script>

<span class="top">
  {#each nodes as node}
    {#if node.type == "text"}
      <span class="text">
        <BoldChars
          text={node.content}
          indices={indices ?? []}
          offset={node.range.from + node.startPadding}
        ></BoldChars>
      </span>
    {:else if node.type == "tag"}
      <Tag
        parts={node.parts}
        startPadding={node.startPadding}
        range={node.range}
        {indices}
      ></Tag>
    {/if}
  {/each}
</span>

<style>
  .top {
    display: flex;
    flex-direction: row;
    font-size: 16px;
    align-items: center;

    --radius-small: 0px;
    --radius-big: 16px;
    --padding-vertical: 2px;
    gap: 2px;
  }
  .text {
    padding: var(--padding-vertical) 1px;
    line-height: 1;
  }
</style>
