<script lang="ts">
  import type { Snippet } from "svelte";
  import { platform } from "./platform";

  let {
    children,
    hideBack,
    onclick,
  }: {
    children: Snippet;
    hideBack: boolean;
    onclick?: (event: MouseEvent) => void;
  } = $props();

  let element: HTMLElement;
</script>

<button
  class="outer"
  class:hideBack
  class:android={$platform == "android"}
  onclick={(event) => {
    if (event.detail === 0) return;
    if (event.target == element) {
      onclick?.(event);
    }
  }}
  bind:this={element}
>
  <div class="content">
    {@render children()}
  </div>
</button>

<style>
  .outer {
    top: 0;
    width: 100vw;
    height: 100vh;
    position: fixed;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 20vh;
    box-sizing: border-box;
    background: none;
  }
  .outer.hideBack {
    background: oklch(var(--level-1) 0 0);
  }
  .outer.android {
    padding-top: 10vh;
  }

  .content {
    position: relative;
    width: calc(100% - 16px);
    max-width: 500px;
    box-sizing: border-box;
    background: var(--palette-back);
    border-radius: 8px;
  }
</style>
