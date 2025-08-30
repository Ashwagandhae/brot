<script lang="ts">
  import { goto } from "$app/navigation";
  import { getViewStateContext } from "$lib/viewState";
  import { onMount } from "svelte";
  import { msg } from "$lib/message";
  import { getComponentPaletteContext } from "$lib/componentPalette";
  import { withProps } from "$lib/componentProps";
  import CheckerEdit from "$lib/CheckerEdit.svelte";
  import TextChecker from "$lib/TextChecker.svelte";
  import TitleOutputDisplay from "$lib/TitleOutputDisplay.svelte";
  import { parseTitleFromString } from "$lib/parse";

  let viewState = getViewStateContext();
  $viewState = { type: "new" };

  async function createAndGotoNote(title: string) {
    let path = await msg("createNote", { title });
    console.log("created note with path:", path);
    if (path == null) {
      openTitlePalette();
      return;
    }
    goto(`./note?p=${path}`);
  }

  let componentPaletteContext = getComponentPaletteContext();
  function openTitlePalette() {
    componentPaletteContext()(
      withProps(CheckerEdit<string, string>, {
        Checker: TextChecker<string>,
        init: "",
        setVal: async (newTitle: string) => {
          createAndGotoNote(newTitle);
        },
        toVal: parseTitleFromString,
        outputDisplay: withProps(TitleOutputDisplay, {}),
      })
    );
  }
  onMount(() => {
    setTimeout(openTitlePalette, 0);
  });
</script>

<div class="top"></div>

<style>
  .top {
    display: flex;
    flex-direction: column;
    width: 100%;
    align-items: center;
  }
</style>
