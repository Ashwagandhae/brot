<script lang="ts">
  import type { Snippet } from "svelte";
  import { platform } from "./platform";
  import type { PartialAction } from "../../src-tauri/bindings/PartialAction";
  import ActionButton from "./ActionButton.svelte";
  import { getViewStateContext } from "./viewState";

  let {
    children,
    runAction,
    paletteActive,
  }: {
    children: Snippet;
    runAction: (action: PartialAction) => void;
    paletteActive: boolean;
  } = $props();

  let viewState = getViewStateContext();
</script>

<main class:android={$platform == "android"}>
  <div class="topbar" data-tauri-drag-region></div>
  <div class="content">
    {@render children()}
  </div>
  {#if $platform == "android"}
    <div class="navButtons">
      <ActionButton
        icon="plus"
        selected={$viewState?.type == "new"}
        onclick={() => runAction({ key: "goto", args: ["false", "new"] })}
      ></ActionButton>
      <ActionButton
        icon="hamburger"
        selected={$viewState?.type == "pinned"}
        onclick={() => runAction({ key: "goto", args: ["false", "pinned"] })}
      ></ActionButton>
      <ActionButton
        icon="dots"
        selected={paletteActive}
        onclick={() => runAction({ key: "openPalette", args: ["action"] })}
      ></ActionButton>
      <ActionButton
        icon="gear"
        selected={$viewState?.type == "settings"}
        onclick={() => runAction({ key: "goto", args: ["false", "settings"] })}
      ></ActionButton>
      <ActionButton
        icon="triangleRight"
        onclick={() => runAction({ key: "historyForward", args: [] })}
      ></ActionButton>
    </div>
  {/if}
</main>

<style>
  main {
    height: 100vh;
    overflow-y: auto;
    position: relative;
  }
  main.android {
    padding-top: 20px;
  }
  div.topbar {
    position: fixed;
    display: flex;
    top: 0;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    height: var(--topbar-height);
    width: 100%;
    font-size: 16px;
    background: var(--back);
    z-index: 1;
  }
  .android .content {
    padding-bottom: 200px;
  }

  .navButtons {
    position: fixed;
    bottom: 0px;
    flex-direction: row;
    background: var(--back-1);
    width: 100%;
    height: 64px;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  }
</style>
