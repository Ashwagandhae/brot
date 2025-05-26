<script lang="ts">
  import { getContext, onMount } from "svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { platform } from "./platform";

  let { children } = $props();

  let floating: boolean = $state(false);

  async function toggleFloat() {
    let win = getCurrentWindow();
    floating = !(await win.isAlwaysOnTop());
    win.setAlwaysOnTop(floating);
  }

  onMount(async () => {
    if ($platform == "window") {
      floating = await getCurrentWindow().isAlwaysOnTop();
    }
  });
</script>

<main>
  <div class="topbar" data-tauri-drag-region></div>
  <div class="buttons" class:window={$platform == "window"}>
    {#if $platform == "window"}
      <button onclick={toggleFloat} class:toggled={floating}>f</button>
    {/if}
  </div>
  {@render children()}
  {#if $platform == "android"}{/if}
  <div class="androidButtons"><button>jello</button></div>
</main>

<style>
  main {
    height: 100vh;
    overflow-y: auto;
    position: relative;
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

  .buttons {
    position: fixed;
    width: auto;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;

    top: 0;
    left: 0;
    padding-left: 4px;
    padding-top: 4px;
    gap: 4px;
    pointer-events: none;
    z-index: 10000;
  }

  .buttons.window {
    left: 64px;
  }

  button {
    height: 20px;
    width: 20px;

    font-size: 1rem;
    border-radius: 50%;
    pointer-events: all;
  }
  .androidButtons {
    position: fixed;
    bottom: 100px;
    z-index: 1000000;
    left: 100px;
  }
</style>
