<script lang="ts">
  let { onclick }: { onclick?: (event: MouseEvent) => void } = $props();
</script>

<button class="scrollPadding" {onclick} aria-label="padding"></button>

<style>
  .scrollPadding {
    height: calc(100vh - 35px);
    width: 100%;
    background: none;
  }
</style>
