---
kind: eval-artifact
run: 6
variant: R
replicate: r2
task: T5
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

It will not work. It will also make the code slower and harder to read. `useCallback` prevents a re-render only when the child is wrapped in `React.memo`, and only when every *other* prop is stable too.

## What useCallback does

`useCallback` returns the same function reference across renders as long as its dependencies do not change. That is all it does. It does not tell React to skip anything.

By default, a parent that re-renders re-renders all its children. Their props do not matter. React never compares prop identity. So a memoized callback passed to an ordinary child changes nothing about what renders.

To make React compare props and bail out, wrap the child:

```jsx
const Child = React.memo(function Child({ onSave }) { ... })
```

`React.memo` does a shallow compare of props. *Now* a stable `onSave` matters, because an unstable one fails the compare and defeats the memo.

So the two are a pair. `useCallback` without `React.memo` is dead weight. `React.memo` without stable props is dead weight. Your teammate is proposing to build half of a mechanism.

## The other half breaks

Even with `React.memo` in place, one unstable prop defeats the whole thing. All these are new references every render:

```jsx
<Child
  onSave={handleSave}          // stabilized ✓
  style={{ margin: 8 }}        // new object every render ✗
  items={data.filter(Boolean)} // new array every render ✗
  render={() => <Icon />}      // new function every render ✗
/>
```

The memo compare fails on `style`. The child re-renders. The `useCallback` bought nothing. This is why most memoization work produces no measurable improvement: people stabilize the obvious prop and miss the inline object next to it.

`children` is the sneakiest version. JSX children are new element objects on each render, so a memoized component that takes `children` never bails out.

## Dependencies leak

`useCallback` is stable only while its deps are. A callback that depends on a value changing each render looks stable and is not:

```jsx
const handleSave = useCallback(() => save(draft), [draft])
// draft changes on every keystroke → new function on every keystroke
```

You added a hook, an array, and a lint rule to satisfy. The behavior matches what you had before.

## What it costs

Memoization is not free:

- Every `useCallback` allocates the array, stores the function, and runs a dependency compare on every render. That cost is small and nonzero, and you pay it on *all* renders, including the ones that were already fine.
- Dependency arrays are a correctness hazard. An omitted dep gives you a stale closure — a handler holding last render's state. Those bugs are subtle and hard to trace.
- The code gets noisier. Every handler grows a wrapper and a dep list. Readers now have to decide whether each one is load-bearing.

Applied blanket-style across a codebase, this is a guaranteed cost against a speculative benefit.

## When it earns its place

Reach for `useCallback` when one of these is true:

1. The child is wrapped in `React.memo` **and** rendering it is measurably expensive — a large list, a chart, a heavy tree.
2. The function is a dependency of another hook, usually a `useEffect`. Here stability is a *correctness* concern, not a performance one. An unstable function re-runs the effect on every render, which means a re-subscribe or a refetch per keystroke.
3. You pass it to a hand-written hook that stores it in a dependency array.

Case 2 is the one people underrate. It has nothing to do with re-renders. It is the one reason a `useCallback` in a codebase is necessary.

## First moves that work better

Try the structural fixes before memoizing anything. They win more and they need no maintaining:

- **Move state down.** If one subtree uses a piece of state, put the state there. The parent stops re-rendering and the question disappears.
- **Pass children as props.** A component rendering `{children}` does not re-render those children when its own state changes. The parent created the elements. You get memo-like behavior for free.
- **Split the component.** Frequently-changing state sitting next to expensive rendering is the problem. Separating them fixes it at the root.

## And measure

Turn on "Highlight updates" in React DevTools, or use the Profiler. Find out what re-renders and what it costs. Most re-renders are cheap, because React is fast at re-rendering components that produce the same output. Optimizing a render that takes 0.3ms is work you cannot detect afterward.

On React 19 with the compiler enabled, the question is moot. The compiler inserts memoization and does a more thorough job than a human applying it by hand.

**Short version to give your teammate:** wrapping everything in `useCallback` stops zero re-renders unless the children are memoized, and it adds cost and stale-closure risk everywhere. Profile first, then memoize the two or three places that show up.
