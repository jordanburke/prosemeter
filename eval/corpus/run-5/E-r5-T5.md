---
kind: eval-artifact
run: 5
variant: E
replicate: r5
task: T5
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
No, it will not work, and it will cost you a little performance and a lot of noise. `useCallback` alone stops nothing from re-rendering.

## Why it does nothing on its own

A React component re-renders when its parent re-renders. That is the default, and prop identity does not enter into it. React does not compare props before re-rendering a child; it just renders.

`useCallback` gives you a stable function reference across renders. Nothing reads that stability unless something is comparing props — and by default nothing is.

So the child re-renders either way. You added a hook, a dependency array, and an allocation for the memoized reference, and got the same render count.

## What actually stops the re-render

The comparison has to exist. `React.memo` is what creates it.

```jsx
const Child = React.memo(function Child({ onSelect }) { ... })
```

`memo` shallow-compares props and skips the render when they are all equal by reference. *Now* a stable `onSelect` matters, because an inline arrow is a new reference every render and would fail the comparison every time.

`useCallback` and `React.memo` work as a pair. Either one alone does nothing.

## The pair breaks easily

Even with both, one unstable prop defeats the whole thing. Shallow comparison is all-or-nothing.

```jsx
<Child onSelect={stableCallback} style={{ margin: 8 }} />
```

That object literal is new on every render, so `memo` bails and the callback was wasted. The same goes for inline arrays, inline JSX passed as a prop, and any object built in the render body.

## When memoizing is worth it

Reach for it when a render is genuinely expensive: a large list, a chart, a tree, a component doing real work per render. Measure it with the React Profiler and confirm the component shows up before you change anything.

Wrapping cheap components makes things slower. React now allocates the memoized reference, keeps the dependency array, and runs a shallow comparison — all to skip a render that cost less than the check.

There is one case where `useCallback` matters without `memo`: when the function is a dependency of another hook. A `useEffect` that depends on a callback re-runs whenever that callback's identity changes, so stability there prevents a real bug rather than a hypothetical render.

## What to suggest instead

Look for the cause before reaching for the cure. Most re-render problems come from state living too high in the tree. Move the state down to the component that uses it, or split the component, and the re-renders disappear without any memoization at all.

Then, if a measured hot spot remains, memoize that one component and the props it takes. Blanket `useCallback` is a policy, and this problem needs a diagnosis.

## The near future

React Compiler inserts this memoization automatically and gets the dependencies right more reliably than hand-written arrays. If the project adopts it, hand-written `useCallback` becomes redundant. That is another reason not to spend a week adding it everywhere.
