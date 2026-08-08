---
kind: eval-artifact
run: 5
variant: L
replicate: r5
task: T5
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work, and it will cost you. `useCallback` alone stops nothing, because a plain child re-renders when its parent re-renders no matter how stable its props are. Wrapping every prop callback adds memory and code noise for no gain.

## Why the callback alone does nothing

React re-renders a child whenever its parent re-renders. That is the default and it does not consult props.

`useCallback` only keeps the function reference the same across renders. A stable reference matters to exactly one thing: a comparison that decides whether to skip work. If nobody is comparing, stability buys nothing.

So this changes nothing at all:

```jsx
const handleClick = useCallback(() => setOpen(true), [])
return <Button onClick={handleClick} />   // Button still re-renders
```

## What actually skips the render

The child has to be wrapped in `React.memo`. `memo` compares the new props to the old ones and skips the render when they match.

```jsx
const Button = React.memo(function Button({ onClick }) { ... })
```

Now the comparison exists, and now a stable `onClick` matters — because `memo` compares props with `Object.is`, and a fresh arrow function fails that check every render.

The two work as a pair. `memo` on the child, `useCallback` on the function. Either one alone does nothing.

## The other props break it too

Adding `memo` and `useCallback` still fails if any other prop is a fresh value each render:

```jsx
<Button onClick={handleClick} style={{ margin: 8 }} />
```

That object literal is new every render, so `memo` sees changed props and renders anyway. Same for array literals, inline objects, and children defined as JSX in the parent. Every non-primitive prop has to be stable, or the memo is dead weight.

## Why wrapping everything is worse than doing nothing

`useCallback` is not free. It allocates the dependency array, stores it, and compares it on every render. For a function that would have been re-created anyway, you have added work and kept the old function alive in memory.

It also creates a correctness risk. A wrong dependency array captures a stale value, and you get a bug that reproduces only after a specific sequence of interactions. Those are miserable to find. An unmemoized function is always correct.

And it spreads. Once a child is memoized, every prop it receives has to stay stable, so the requirement climbs back up through the parents. You end up memoizing half the tree to protect one component.

## What to do instead

Measure first. Open the React DevTools Profiler, record an interaction, and look at what actually renders and how long it takes. Most re-renders are under a millisecond and invisible. Optimize the ones the profiler flags.

Before reaching for memo, try moving state down. If the state lives in the smallest component that uses it, the expensive siblings never render at all. That fixes the cause rather than blocking the symptom.

Passing children through also helps:

```jsx
<Layout><ExpensiveThing /></Layout>
```

`ExpensiveThing` is created by the grandparent, so `Layout` re-rendering does not re-render it. No memo involved.

Reach for `memo` plus `useCallback` when the profiler shows a specific child that is genuinely expensive — a long list, a chart, a heavy tree. That is a handful of components in a real app, not all of them.

## One thing that may make this moot

The React Compiler inserts memoization automatically and gets the dependencies right. If your project can adopt it, hand-written `useCallback` largely goes away. Check whether that is on your roadmap before you invest a week in wrapping functions by hand.
