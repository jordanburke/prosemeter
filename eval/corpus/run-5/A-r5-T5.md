---
kind: eval-artifact
run: 5
variant: A
replicate: r5
task: T5
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work, and it will cost you readability and a little memory in exchange for nothing. `useCallback` is one half of a two-part mechanism, and the other half is almost certainly missing.

## Why the stable function alone does nothing

A parent re-render re-renders all of its children by default. React does not compare props to decide; it just walks the tree. Giving a child the exact same function reference does not change that — the child re-renders regardless.

The only thing that makes React skip a child is `React.memo`. That wrapper tells React to shallowly compare the new props against the old ones and bail out of the render if they all match.

```jsx
const Child = React.memo(function Child({ onSelect }) { ... })
```

Now prop identity matters, and now `useCallback` earns its place. Without `memo`, a stabilized callback is compared against nothing. You have added a hook, an inline dependency array, and a maintenance burden, and the render count is identical.

So the honest form of the rule is: `useCallback` is useless unless the receiving component is memoized, and it only helps when that component is expensive enough for a skipped render to matter.

## Why it still often fails after adding memo

`memo` does a shallow comparison across *every* prop. One unstable prop defeats it entirely. These are the usual culprits:

```jsx
<Child
  onSelect={stableCallback}   // fine
  style={{ margin: 8 }}       // new object every render — memo always fails
  items={data.filter(Boolean)} // new array every render — same
  render={() => <Icon />}      // new function every render — same
/>
```

Stabilizing one function while leaving an inline object next to it accomplishes nothing. This is the single most common reason a memoization effort produces no measurable change.

`children` deserves a specific warning. JSX children are new element objects on every render, so a memoized component receiving `children` almost never bails out.

## Why "every function" is the wrong scope

Beyond not working, blanket application has real costs:

- **It is not free.** `useCallback` allocates the closure anyway, then also stores it and compares the dependency array. For a cheap child, you are adding work to avoid work that was cheaper.
- **Dependency arrays rot.** Every one is a place to forget a value and ship a stale-closure bug — a handler holding last render's state. That is a correctness risk you take on in exchange for a performance benefit you cannot demonstrate.
- **It obscures the code.** Reviewers cannot tell which wrappers are load-bearing when all of them are wrapped.

## What to do instead

**Measure first.** React DevTools Profiler shows which components rendered, how long each took, and why. Record an interaction that feels slow. If the flame graph is a wall of sub-millisecond renders, re-render count is not your problem — you are optimizing the wrong thing.

**Then fix the specific case.** When the profiler names an expensive component, memoize *that* one and stabilize *all* of its props. Verify with the profiler that it now bails out.

**Prefer structural fixes.** They usually beat memoization outright:

- Move state down. If only one subtree cares about a value, the state belongs there, and the rest of the tree never re-renders.
- Pass expensive subtrees as `children` from a parent that does not re-render. Elements created above the state change are reused as-is.
- Split large context values, or move to a store with selector subscriptions, so a consumer only wakes for the slice it reads.

**Note the compiler.** The React Compiler memoizes automatically and correctly, and where it is enabled, hand-written `useCallback` and `useMemo` become largely redundant. If adopting it is plausible for your codebase, that is a stronger move than a manual sweep.

## The short version to give your teammate

Wrapping every prop function does not stop re-renders — only `React.memo` does that, and it only holds if every other prop is stable too. Profile the interaction, find the component that is actually expensive, and fix that one.
