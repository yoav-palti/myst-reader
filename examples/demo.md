# MyST Reader demo

```{admonition} מערכות LTI
:class: tip

$$T\{x(t)\}=x(t)\ast h(t)$$
$$x(t)\ast h(t)=\int_{-\infty}^{\infty}x(\tau)h(t-\tau)\,d\tau$$
```

The following examples use the **MyST preview** pane.

::::{note} Nested directives

:::{warning} Check the units
Frequency in hertz differs from angular frequency in radians per second.
:::
::::

:::{dropdown} Worked example

For {math}`x=2`, the result is {math}`x^2=4`.
:::

(convolution)=
## Convolution

Use {ref}`the definition <convolution>` or {eq}`eq-energy`.

:::{math}
:label: eq-energy

E = \int_{-\infty}^{\infty}|x(t)|^2\,dt
:::

:::{list-table} Common quantities
:header-rows: 1

* - Quantity
  - Unit
* - Frequency
  - Hz
* - Time
  - s
:::

:::{code-cell} python
print("This code is displayed, never executed.")
:::

:::{include} another-file.md
:::
