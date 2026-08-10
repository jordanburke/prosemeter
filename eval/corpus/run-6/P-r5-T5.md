---
kind: eval-artifact
run: 6
variant: P
replicate: r5
task: T5
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

It will not work. It buys nothing and costs readability plus a little memory. `useCallback` is half of a two-part mechanism, and the other half is almost certainly missing.

## Why a stable function alone does nothing

A parent re-render re-renders its children by default. React does not compare props to decide; it walks the tree. Handing a child the identical function reference changes none of that, and the child re-renders anyway.

Only `React.memo` makes React skip a child. That wrapper tells React to compare new props against old ones shallowly and bail out when they all match.

```jsx
const Child = React.memo(function Child({ onSelect }) { ... })
```

Now prop identity matters, and now `useCallback` earns its place. Without `memo`, a stabilized callback is compared against nothing: you added a hook, a dependency array, and a maintenance burden, and the render count did not move.

The honest rule: `useCallback` does nothing unless the receiving component is memoized, and it helps only when that component is expensive enough for a skipped render to be worth something.

## Why it often still fails after adding memo

`memo` compares *every* prop. One unstable prop defeats it completely. The usual culprits:

```jsx
<Child
  onSelect={stableCallback}   // fine
  style={{ margin: 8 }}       // new object every render — memo always fails
  items={data.filter(Boolean)} // new array every render — same
  render={() => <Icon />}      // new function every render — same
/>
```

Stabilizing one function while an inline object sits next to it achieves nothing. This is the most common reason a memoization effort shows no measurable change.

`children` needs its own warning. JSX children are new element objects every render, so a memoized component that takes `children` almost never bails out.

## Why "every function" is the wrong scope

Beyond not working, a blanket sweep has real costs:

- **It is not free.** `useCallback` allocates the closure anyway, then stores it and compares the dependency array. For a cheap child you add work to avoid cheaper work.
- **Dependency arrays rot.** Each one is a place to forget a value and ship a stale closure — a handler holding last render's state. That is a correctness risk taken for a performance gain you cannot demonstrate.
- **It hides intent.** When every wrapper is there, reviewers cannot tell which ones are load-bearing.

## What to do instead

**Measure first.** The React DevTools Profiler shows which components rendered, how long each took, and why. Record the interaction that feels slow. A flame graph full of sub-millisecond renders means render count is not your problem.

**Then fix the named case.** When the profiler points at an expensive component, memoize *that* one and stabilize *all* of its props. Confirm with the profiler that it now bails out.

**Prefer structural fixes.** They usually beat memoization outright:

- Move state down. If one subtree cares about a value, put the state there and the rest of the tree stops re-rendering.
- Pass expensive subtrees as `children` from a parent that does not re-render. Elements created above the state change are reused as they are.
- Split large context values, or move to a store with selector subscriptions, so a consumer wakes only for the slice it reads.

**Consider the compiler.** The React Compiler memoizes automatically and correctly, and where it runs, hand-written `useCallback` and `useMemo` become largely redundant. If your codebase can adopt it, that beats a manual sweep.

## The short version for your teammate

Wrapping every prop function does not stop re-renders. Only `React.memo` does, and it holds only when every other prop is stable too. Profile the interaction, find the component that is genuinely expensive, and fix that one.
