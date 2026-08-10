---
kind: eval-artifact
run: 6
variant: R
replicate: r5
task: T5
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

It will not work. It costs readability and a few bytes of memory and buys nothing. `useCallback` is one half of a two-part mechanism, and the other half is missing.

## Why the stable function alone does nothing

A parent re-render re-renders all its children by default. React does not compare props to decide. It walks the tree. Hand a child the same function reference and the child still re-renders.

One thing makes React skip a child: `React.memo`. That wrapper tells React to compare the new props shallowly against the old ones and skip the render when they all match.

```jsx
const Child = React.memo(function Child({ onSelect }) { ... })
```

Now prop identity matters, and `useCallback` earns its place. Without `memo`, React compares your stabilized callback against nothing at all — you have added a hook, an inline dependency array, and a maintenance burden, and the render count has not moved.

So the honest form of the rule has two conditions. `useCallback` does nothing unless the receiving component is memoized. It helps only when that component is expensive enough that a skipped render matters.

## Why it fails even after you add memo

`memo` compares *every* prop shallowly. One unstable prop defeats it. These are the usual culprits:

```jsx
<Child
  onSelect={stableCallback}   // fine
  style={{ margin: 8 }}       // new object every render — memo always fails
  items={data.filter(Boolean)} // new array every render — same
  render={() => <Icon />}      // new function every render — same
/>
```

Stabilize one function and leave an inline object beside it, and you have gained nothing. This is the top reason a memoization effort produces no measurable change.

`children` deserves its own warning. JSX children are new element objects on every render, so a memoized component receiving `children` rarely bails out.

## Why "every function" is the wrong scope

Beyond not working, a blanket sweep has real costs:

- **The hook is not free.** `useCallback` allocates the closure anyway, then stores it and compares the dependency array. For a cheap child, you add work to avoid work that was cheaper.
- **Dependency arrays rot.** Every array is a place to forget a value and ship a stale-closure bug — a handler holding last render's state. You take on a correctness risk in exchange for a performance benefit you cannot show.
- **It obscures the code.** Wrap every function and reviewers cannot tell which wrappers are load-bearing.

## What to do instead

**Measure first.** The React DevTools Profiler shows which components rendered, how long each took, and why. Record an interaction that feels slow. If the flame graph is a wall of sub-millisecond renders, re-render count is not your problem, and you are optimizing the wrong thing.

**Then fix the specific case.** When the profiler names an expensive component, memoize *that* one and stabilize all its props. Verify in the profiler that it now bails out.

**Prefer structural fixes.** They beat memoization outright:

- Move state down. If one subtree cares about a value, the state belongs there, and the rest of the tree never re-renders.
- Pass expensive subtrees as `children` from a parent that does not re-render. React reuses elements created above the state change.
- Split large context values, or move to a store with selector subscriptions, so a consumer wakes only for the slice it reads.

**Note the compiler.** The React Compiler memoizes automatically and correctly. Where it runs, hand-written `useCallback` and `useMemo` become redundant. If your codebase can adopt it, that beats a manual sweep.

## The short version to give your teammate

Wrapping every prop function does not stop re-renders. Only `React.memo` does that, and it holds only when every other prop is stable too. Profile the interaction, find the component that is expensive, and fix that one.
