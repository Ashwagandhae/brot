<script lang="ts">
  import type { Snippet } from "svelte";
  import { platform } from "./platform";

  let {
    children,
    hideBack,
  }: {
    children: Snippet;
    hideBack: boolean;
  } = $props();
</script>

<div class="outer" class:hideBack class:android={$platform == "android"}>
  <div class="content">
    {@render children()}
  </div>
</div>

<style>
  div.outer {
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
  }
  div.outer.hideBack {
    background: var(--back);
  }
  div.outer.android {
    padding-top: 10vh;
  }

  .content {
    width: 100%;
    max-width: 350px;
    box-sizing: border-box;
    background: var(--palette-back);
    border-radius: 8px;
  }
</style>
