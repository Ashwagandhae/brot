<script lang="ts">
  import BoldChars from "./BoldChars.svelte";
  import { pathToTitleNodes } from "./path";

  let { path, indices }: { path: string; indices?: number[] } = $props();

  let nodes = $derived(pathToTitleNodes(path));
</script>

<div class="top">
  {#each nodes as node}
    {#if node.type == "text"}
      <div class="text">
        <BoldChars
          text={node.content}
          indices={indices ?? []}
          offset={node.range.from + node.startPadding}
        ></BoldChars>
      </div>
    {:else if node.type == "tag"}
      <div class="tag">
        {#each node.parts as part}
          <div class="tagPart">
            <BoldChars
              text={part.content.replaceAll("-", " ")}
              indices={indices ?? []}
              offset={node.range.from +
                node.startPadding +
                part.range.from +
                part.startPadding}
            ></BoldChars>
          </div>
        {/each}
      </div>
    {/if}
  {/each}
</div>

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
  .tag {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 3px;
  }
  .tagPart {
    background: hsla(0, 0%, 100%, 0.15);
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
</style>
