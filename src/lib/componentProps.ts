import type { Component, ComponentProps, SvelteComponent } from "svelte";

const withPropsBrand: unique symbol = Symbol("withPropsBrand");

export type WithProps<
  Props extends Record<string, any>,
  OmitKeys extends keyof Props
> = {
  Component: Component<Props>;
  props: Omit<Props, OmitKeys>;
  [withPropsBrand]: void;
};

export function withProps<
  Props extends Record<string, any>,
  OmitKeys extends string,
  T extends abstract new (...args: any) => SvelteComponent<Props>
>(
  component: T,
  props: Omit<ComponentProps<InstanceType<T>>, OmitKeys>
): WithProps<Props, OmitKeys>; // generics use classes still for some reason

export function withProps<
  Props extends Record<string, any>,
  OmitKeys extends keyof Props,
  T extends Component<Props>
>(
  Component: T,
  props: Omit<ComponentProps<T>, OmitKeys>
): WithProps<Props, OmitKeys> {
  return {
    Component,
    props,
    [withPropsBrand]: undefined,
  };
}
