<script lang="ts">
  import { onMount } from "svelte";

  let {
    value = $bindable(),
    onaccept,
    oncancel,
    element = $bindable(),
    placeholder,
    flat,
    autofocus,
    onkeydown,
    onfocus,
  }: {
    value: string;
    onaccept?: () => void;
    oncancel?: () => void;
    element?: HTMLElement;
    placeholder?: string;
    flat?: boolean;
    autofocus?: boolean;
    onkeydown?: (event: KeyboardEvent) => void;
    onfocus?: (event: FocusEvent) => void;
  } = $props();

  function handleKeydown(event: KeyboardEvent) {
    onkeydown?.(event);
    if (event.key == "Enter") {
      event.preventDefault();
      event.stopPropagation();
      onaccept?.();
    } else if (event.key == "Escape") {
      event.preventDefault();
      event.stopPropagation();
      oncancel?.();
    }
  }
  function handleBlur() {
    if (document.hasFocus()) {
      oncancel?.();
    }
  }
  onMount(() => {
    if (autofocus) {
      element?.focus();
    }
  });
</script>

<input
  class:flat
  bind:this={element}
  type="text"
  bind:value
  onkeydown={handleKeydown}
  onblur={handleBlur}
  {onfocus}
  {placeholder}
/>

<style>
  input {
    background: var(--back-1);
    border: none;
    color: var(--text);
    font-size: 16px;
    padding: 8px;
    border-radius: 8px;
    box-sizing: border-box;
    height: 32px;
    width: 100%;
  }
  input:hover,
  input:focus {
    background: var(--back-2);
    outline: none;
  }
  input:active {
    background: var(--back-3);
    outline: none;
  }
  input::placeholder {
    color: var(--text-weak);
    opacity: 1;
  }

  input.flat {
    background: var(--back-1);
  }
</style>
