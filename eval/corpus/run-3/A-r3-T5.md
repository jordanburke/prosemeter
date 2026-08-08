---
kind: eval-artifact
run: 3
variant: A
replicate: r3
task: T5
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Mostly it won't, and it'll cost you readability for nothing. `useCallback` alone doesn't stop a single re-render.

Here's the missing half. By default, when a parent re-renders, React re-renders all its children — **regardless of props**. Props aren't consulted at all. So:

```jsx
const handleClick = useCallback(() => {...}, [])
return <Child onClick={handleClick} />
```

`Child` still re-renders every time the parent does. The stable function reference changed nothing, because nothing was checking references.

The reference only starts mattering once the child is wrapped in `React.memo`, which is what actually introduces a props comparison:

```jsx
const Child = React.memo(function Child({ onClick }) { ... })
```

Now `memo` shallow-compares props, `onClick` is reference-equal thanks to `useCallback`, and the child bails out. **`useCallback` and `memo` are one mechanism split across two call sites** — either one alone is dead weight.

Even paired, there are ways it silently stops working:

- **Any other unstable prop defeats it.** `<Child onClick={handleClick} style={{margin: 4}} />` — that object literal is new every render, shallow compare fails, child re-renders, and the `useCallback` did nothing. Same for `items={data.filter(...)}` and `config={{...}}`.
- **A wrong dep array is worse than none.** If the callback closes over state you left out of the deps, you get a stale closure: the child holds a function reading last render's values. That's a real bug, and it's harder to find than an extra render.
- **`children` breaks it.** `<Memoized><span/></Memoized>` creates a new element object each render, so a memoized component with children rarely bails out.

And the economics are bad in the general case. `useCallback` isn't free — it allocates the deps array, runs the comparison, and holds the previous function alive on every render. For a component that renders quickly, you're paying that on every render to avoid a re-render that was cheap anyway. Blanket-wrapping means paying it hundreds of times to win in maybe three places.

What I'd suggest instead: **profile first.** React DevTools Profiler, record an interaction, look at what's actually expensive. Memoize the components that show up as slow — typically big lists, charts, heavy tables — and add `useCallback` to the props those specific components receive. That's usually a handful of places in a codebase, not every prop.

Two exceptions where reaching for `useCallback` without profiling is defensible: when the function is a **dependency of a `useEffect`** (there an unstable reference doesn't just cost a render, it re-fires the effect — resubscribing, refetching), and when you're **writing a shared library component** and can't see the caller's render frequency.

Also worth knowing: if you're on React 19 with the compiler enabled, it inserts this memoization automatically and hand-written `useCallback` is largely redundant. Worth checking which version you're targeting before doing the work by hand.
