<script lang="ts">
  import type { Snippet } from "svelte";
  import { platform } from "./platform";
  import ActionButton from "./ActionButton.svelte";
  import { getViewStateContext } from "./viewState";
  import type { ParsedPartialAction } from "./actions";

  let {
    children,
    runAction,
    paletteActive,
  }: {
    children: Snippet;
    runAction: (action: ParsedPartialAction) => void;
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
        onclick={() => runAction({ key: "goto", parsedArgs: [false, "new"] })}
      ></ActionButton>
      <ActionButton
        icon="hamburger"
        selected={$viewState?.type == "pinned"}
        onclick={() =>
          runAction({ key: "goto", parsedArgs: [false, "pinned"] })}
      ></ActionButton>
      <ActionButton
        icon="dots"
        selected={paletteActive}
        onclick={() =>
          runAction({ key: "openPalette", parsedArgs: ["action"] })}
      ></ActionButton>
      <ActionButton
        icon="gear"
        selected={$viewState?.type == "settings"}
        onclick={() =>
          runAction({ key: "goto", parsedArgs: [false, "settings"] })}
      ></ActionButton>
      <ActionButton
        icon="triangleRight"
        onclick={() => runAction({ key: "historyForward", parsedArgs: [] })}
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
    background-attachment: fixed;
    background-size: cover;
    z-index: 1;
    overflow: hidden;
  }

  div.topbar::before {
    content: "";
    position: absolute; /* Fits to the container, not the window */
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh; /* Matches the exact height of .my-container */

    /* Your background styles */
    background: var(--back-gradient);
    background-size: cover;
    background-position: center;

    /* Send to back */
    z-index: -1;

    /* Performance optimization */
    will-change: transform;
  }

  .android .topbar {
    height: calc(20px + var(--topbar-height));
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
    z-index: 99999;
  }
</style>
