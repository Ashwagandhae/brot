<script lang="ts">
  import { onMount } from "svelte";
  import type { Settings } from "../../../src-tauri/bindings/Settings";
  import { getViewStateContext } from "$lib/viewState";
  import { msg } from "$lib/message";
  let viewState = getViewStateContext();
  $viewState = { type: "settings" };

  let settings: Settings = $state({ notesPath: null, windowStates: {} });

  onMount(async () => {
    settings = await msg("getSettings");
  });

  async function updateSettings() {
    await msg("updateSettings", { settings });
  }
</script>

<main>
  <h1>Settings</h1>
  <form onsubmit={updateSettings}>
    <textarea bind:value={settings.notesPath}></textarea>
    <button type="submit">Submit</button>
    <a href="../">back</a>
  </form>
</main>

<style>
  main {
    width: 100%;
    height: 100%;
  }
</style>
