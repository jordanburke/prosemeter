---
kind: eval-artifact
run: 5
variant: A
replicate: r2
task: T5
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work, and it will make the code slower and harder to read. `useCallback` only prevents a re-render when the child is wrapped in `React.memo` — and even then, only if every *other* prop is stable too.

## What useCallback actually does

`useCallback` returns the same function reference across renders as long as its dependencies do not change. That is all it does. It does not tell React to skip anything.

By default, when a parent re-renders, React re-renders all its children — regardless of whether their props changed at all. Prop identity is not consulted. So a memoized callback passed to an ordinary child changes nothing about what renders.

To make React compare props and bail out, the child must be wrapped:

```jsx
const Child = React.memo(function Child({ onSave }) { ... })
```

`React.memo` does a shallow compare of props. *Now* a stable `onSave` matters — because an unstable one would fail the compare and defeat the memo.

So the two are a pair. `useCallback` without `React.memo` is dead weight. `React.memo` without stable props is dead weight. Your teammate is proposing to build half of a mechanism.

## The other half breaks easily

Even with `React.memo` in place, one unstable prop defeats the whole thing. All of these are new references every render:

```jsx
<Child
  onSave={handleSave}          // stabilized ✓
  style={{ margin: 8 }}        // new object every render ✗
  items={data.filter(Boolean)} // new array every render ✗
  render={() => <Icon />}      // new function every render ✗
/>
```

The memo compare fails on `style`, the child re-renders, and the `useCallback` bought nothing. This is why memoization efforts so often produce no measurable improvement: people stabilize the obvious prop and miss the inline object next to it.

`children` is the sneakiest version. JSX children are new element objects on each render, so a memoized component that takes `children` almost never bails out.

## Dependencies leak

`useCallback` is only stable while its deps are. A callback depending on a value that changes each render is a stable-looking function that is not stable:

```jsx
const handleSave = useCallback(() => save(draft), [draft])
// draft changes on every keystroke → new function on every keystroke
```

You have added a hook, an array, and a lint rule to satisfy, and produced exactly the behavior you had before.

## What it costs

Memoization is not free:

- Every `useCallback` allocates the array, stores the function, and runs a dependency compare on every render. Small, but nonzero, and it is paid on *all* renders including the ones that were already fine.
- Dependency arrays are a correctness hazard. An omitted dep gives you a stale closure — a handler holding last render's state. These bugs are subtle and hard to trace.
- The code gets noisier. Every handler grows a wrapper and a dep list, and readers now have to decide whether each one is load-bearing.

Applied blanket-style across a codebase, this is a guaranteed cost against a speculative benefit.

## When it is genuinely worth it

Reach for `useCallback` when one of these is true:

1. The child is wrapped in `React.memo` **and** rendering it is measurably expensive — a large list, a chart, a heavy tree.
2. The function is a dependency of another hook, typically a `useEffect`. Here stability is a *correctness* concern, not a performance one: an unstable function re-runs the effect on every render, which can mean a re-subscribe or a refetch per keystroke.
3. You are passing it to a hand-written hook that stores it in a dependency array.

Case 2 is the one people underrate. It has nothing to do with re-renders and it is often the only reason a `useCallback` in a codebase is actually necessary.

## Better first moves

Before memoizing anything, try the structural fixes — they are usually larger wins and they do not need maintaining:

- **Move state down.** If only one subtree uses a piece of state, put the state there. The parent stops re-rendering and the whole question disappears.
- **Pass children as props.** A component that renders `{children}` does not re-render those children when its own state changes, because the elements were created by the parent. This gets you memo-like behavior for free.
- **Split the component.** Frequently-changing state next to expensive rendering is the actual problem; separating them fixes it at the root.

## And measure

Turn on "Highlight updates" in React DevTools, or use the Profiler, and find out what is actually re-rendering and what it costs. Most re-renders are cheap — React is fast at re-rendering components that produce the same output. Optimizing renders that take 0.3ms is work you cannot detect afterward.

If you are on React 19 with the compiler enabled, this is largely moot anyway: it inserts memoization automatically and does a more thorough job than a human applying it by hand.

**Short version to give your teammate:** wrapping everything in `useCallback` will not stop a single re-render unless the children are memoized, and it adds cost and stale-closure risk everywhere. Profile first, then memoize the two or three places that show up.
