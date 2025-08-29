<script lang="ts">
  import type { MatchedPaletteAction } from "../../src-tauri/bindings/MatchedPaletteAction";
  import { getActionRegistryContext } from "./actions";
  import BoldChars from "./BoldChars.svelte";
  import Icon from "./Icon.svelte";
  import { platform } from "./platform";
  import Shortcut from "./Shortcut.svelte";

  let {
    command,
    selected,
    container,
    onclick,
  }: {
    command: MatchedPaletteAction;
    selected: boolean;
    container: HTMLElement;
    onclick?: (event: MouseEvent) => void;
  } = $props();

  let element: HTMLElement;

  let registry = getActionRegistryContext();

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

<button
  class="top"
  class:selected
  bind:this={element}
  onmousedown={(event) => event.preventDefault()}
  {onclick}
>
  <div class="left">
    <div class="icon">
      <Icon name={command.paletteAction.icon ?? "dots"}></Icon>
    </div>
    <div class="title">
      <BoldChars text={command.paletteAction.title} indices={command.indices}
      ></BoldChars>
    </div>
  </div>
  {#if command.paletteAction.shortcut != null && $platform != "android"}
    <div class="shortcut">
      <Shortcut keyString={command.paletteAction.shortcut} {selected}
      ></Shortcut>
    </div>
  {/if}
</button>

<style>
  .top {
    width: 100%;
    font-size: 16px;
    height: 32px;
    line-height: 1;
    box-sizing: border-box;
    border-radius: 8px;

    display: flex;
    flex-direction: row;
    justify-content: space-between;
    background: none;
  }
  .left {
    display: flex;
    flex-direction: row;
  }
  .title {
    padding: 8px;
    padding-left: 0;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .icon {
    width: 16px;
    height: 16px;
    padding: 8px;
  }
  .shortcut {
    padding: 6px;
  }
  .top.selected {
    background: var(--palette-select);
  }
</style>
