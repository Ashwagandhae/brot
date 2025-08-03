<script lang="ts">
  import type { MatchedPaletteAction } from "../../src-tauri/bindings/MatchedPaletteAction";
  import type { PaletteAction } from "../../src-tauri/bindings/PaletteAction";
  import BoldChars from "./BoldChars.svelte";
  import Icon from "./Icon.svelte";

  let {
    command,
    selected,
    container,
  }: {
    command: MatchedPaletteAction;
    selected: boolean;
    container: HTMLElement;
  } = $props();

  let element: HTMLElement;

  function isElementFullyInContainerView(
    el: HTMLElement,
    container: HTMLElement
  ): boolean {
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    return (
      elRect.top >= containerRect.top &&
      elRect.bottom <= containerRect.bottom &&
      elRect.left >= containerRect.left &&
      elRect.right <= containerRect.right
    );
  }

  $effect(() => {
    if (selected) {
      if (!isElementFullyInContainerView(element, container)) {
        element.scrollIntoView({
          block: "nearest",
          inline: "nearest",
        });
      }
    }
  });
</script>

<div class="top" class:selected bind:this={element}>
  <div class="icon">
    <Icon name={command.paletteAction.icon ?? "dots"}></Icon>
  </div>
  <div class="title">
    <BoldChars text={command.paletteAction.title} indices={command.indices}
    ></BoldChars>
  </div>
</div>

<style>
  .top {
    width: 100%;
    font-size: 16px;
    height: 32px;
    line-height: 1;
    box-sizing: border-box;
    border-radius: 8px;
    background: var(--back-1);

    display: flex;
    flex-direction: row;
  }
  .title {
    padding: 8px;
    padding-left: 0;
    color: var(--text);
  }
  .icon {
    width: 16px;
    height: 16px;
    padding: 8px;
  }
  .top.selected {
    background: var(--back-2);
  }
</style>
