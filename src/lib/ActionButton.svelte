<script lang="ts">
  import Icon from "./Icon.svelte";

  let {
    onclick,
    icon,
    selected,
  }: { onclick?: () => void; icon: string; selected?: boolean } = $props();
</script>

<button {onclick} class:selected>
  <div class="icon">
    <Icon name={icon}></Icon>
  </div>
</button>

<style>
  button {
    width: 100%;
    height: 64px;
    box-sizing: border-box;
    padding: 16px;
    border-radius: 16px;

    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
  }
  button.selected {
    background: var(--back-3);
  }
  .icon {
    width: 24px;
    height: 24px;
  }
</style>
