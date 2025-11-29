<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import type { Suggestion, SuggestionProvider } from "./suggestion";
  import BoldChars from "./BoldChars.svelte";
  import Title from "./Title.svelte";

  let {
    value = $bindable(),
    onaccept,
    oncancel,
    element = $bindable(),
    placeholder,
    autofocus,
    onkeydown,
    onfocus,
    suggestionProvider,
  }: {
    value: string;
    onaccept?: () => void;
    oncancel?: () => void;
    element?: HTMLInputElement;
    placeholder?: string;
    autofocus?: boolean;
    onkeydown?: (event: KeyboardEvent) => void;
    onfocus?: (event: FocusEvent) => void;
    suggestionProvider?: SuggestionProvider | null;
  } = $props();

  let measureSpan: HTMLSpanElement | null = $state(null);
  let caretLeft = $state(0);

  let mirrorText = $state("");

  async function handleKeydown(event: KeyboardEvent) {
    if (element == null) return;
    if (showSuggestions && suggestions.length > 0) {
      let newSelectedIndex = selectedIndex;
      if (event.key == "ArrowUp") {
        newSelectedIndex -= 1;
        event.preventDefault();
        event.stopPropagation();
      } else if (event.key == "ArrowDown") {
        newSelectedIndex += 1;
        event.preventDefault();
        event.stopPropagation();
      } else if (event.key == "Enter") {
        event.preventDefault();
        event.stopPropagation();

        let suggestion = suggestions[selectedIndex];
        let { text, caret } = suggestion.replace();
        value = text;
        showSuggestions = false;
        await tick();
        element.selectionStart = caret;
        element.selectionEnd = caret;
      } else if (event.key == "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (event.metaKey) {
          oncancel?.();
        } else {
          showSuggestions = false;
        }
      } else {
        onkeydown?.(event);
      }
      selectedIndex =
        (newSelectedIndex + suggestions.length) % suggestions.length;
    } else {
      if (event.key == "Enter") {
        event.preventDefault();
        event.stopPropagation();
        onaccept?.();
      } else if (event.key == "Escape") {
        event.preventDefault();
        event.stopPropagation();
        oncancel?.();
      } else {
        onkeydown?.(event);
      }
    }
  }

  let prevValue = value;
  async function updateCaretPosition() {
    if (!element || !measureSpan) return;

    let selectionStart = element.selectionStart ?? 0;
    mirrorText = value.substring(0, selectionStart);
    await tick();

    const paddingLeft = parseFloat(
      window.getComputedStyle(element).paddingLeft
    );
    const textWidth = measureSpan.offsetWidth;
    const scrollLeft = element.scrollLeft;

    caretLeft = paddingLeft + textWidth - scrollLeft;
  }

  function handleScroll() {
    updateCaretPosition();
  }

  onMount(() => {
    if (autofocus) {
      element?.focus();
    }

    updateCaretPosition();
  });

  function handleSelectionChange() {
    if (prevValue != value) {
      prevValue = value;
      showSuggestions = true;
    } else {
      showSuggestions = false;
    }
    updateCaretPosition();
  }

  let suggestions: Suggestion[] = $state([]);
  let selectedIndex: number = $state(0);
  let showSuggestions: boolean = $state(false);

  $effect(() => {
    selectedIndex = 0;
    if (suggestionProvider == null) return;
    (async () => {
      suggestions = await suggestionProvider.search(
        value,
        element!.selectionStart!
      );
      console.log(suggestions);
    })();
  });

  onDestroy(() => {
    suggestionProvider?.stop?.();
  });
</script>

<div class="top">
  <input
    bind:this={element}
    spellcheck="false"
    type="text"
    bind:value
    onkeydown={handleKeydown}
    onselectionchange={handleSelectionChange}
    onscroll={handleScroll}
    {onfocus}
    {placeholder}
  />

  {#if suggestionProvider != null}
    <span bind:this={measureSpan} class="measure">{mirrorText}</span>
    <div class="caret" style="--caret-left: {caretLeft}px">
      <div class="suggestions">
        {#if showSuggestions}
          {#each suggestions as suggestion, index}
            <div class="suggestion" class:selected={selectedIndex == index}>
              <Title path={suggestion.display} indices={suggestion.indices}
              ></Title>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .top {
    height: 32px;
    width: 100%;
    position: relative;
    --suggestions-width: 100px;
  }

  input {
    background: var(--palette-back, #eee);
    border: none;
    color: var(--text, #333);
    font-size: 16px;
    padding: 8px;
    border-radius: 8px;
    box-sizing: border-box;
    height: 100%;
    width: 100%;
    font-family: inherit;
  }

  .measure {
    position: absolute;
    visibility: hidden;
    height: auto;
    width: auto;
    white-space: pre;
    font-size: 16px;
    font-family: inherit;
    padding: 0;
  }

  .caret {
    position: absolute;
    top: 0;
    left: min(100% - 8px, var(--caret-left));
    height: 100%;
    pointer-events: none;
  }

  .suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    background: var(--palette-back-3);
    pointer-events: auto;
    border-radius: 8px;

    display: flex;
    flex-direction: column;
  }
  .suggestion {
    font-size: 16px;
    padding: 4px;
    box-sizing: border-box;
    display: flex;
    flex-direction: row;
    align-items: center;
  }
  .selected.suggestion {
    background: var(--palette-back-4);
    border-radius: 8px;
  }

  input::placeholder {
    color: var(--text-weak);
    opacity: 1;
  }

  input:focus {
    outline: none;
  }
</style>
