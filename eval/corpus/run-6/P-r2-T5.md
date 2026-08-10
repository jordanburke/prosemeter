---
kind: eval-artifact
run: 6
variant: P
replicate: r2
task: T5
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

It will not work. `useCallback` stops a re-render only when the child is wrapped in `React.memo`, and only when every *other* prop is stable too. Applied everywhere, it costs speed and readability and buys nothing.

## What useCallback actually does

`useCallback` returns the same function reference across renders while its dependencies stay the same. That is all it does. It does not tell React to skip anything.

By default, a parent that re-renders re-renders all its children, whether or not their props changed. React never consults prop identity. So a memoized callback passed to an ordinary child changes nothing about what renders.

To make React compare props and bail out, wrap the child:

```jsx
const Child = React.memo(function Child({ onSave }) { ... })
```

`React.memo` shallow-compares props. *Now* a stable `onSave` matters, because an unstable one would fail the compare and defeat the memo.

The two are a pair. `useCallback` without `React.memo` is dead weight. `React.memo` without stable props is dead weight. Your teammate is proposing to build half a mechanism.

## The other half breaks easily

Even with `React.memo` in place, one unstable prop defeats the whole thing. These are all new references every render:

```jsx
<Child
  onSave={handleSave}          // stabilized ✓
  style={{ margin: 8 }}        // new object every render ✗
  items={data.filter(Boolean)} // new array every render ✗
  render={() => <Icon />}      // new function every render ✗
/>
```

The compare fails on `style`, the child re-renders, and the `useCallback` bought nothing. This is why memoization work so often produces no measurable improvement: people stabilize the obvious prop and miss the inline object beside it.

`children` is the sneakiest version. JSX children are new element objects on every render, so a memoized component taking `children` almost never bails out.

## Dependencies leak

A `useCallback` is stable only while its deps are. A callback depending on a value that changes each render is a stable-looking function that is not stable:

```jsx
const handleSave = useCallback(() => save(draft), [draft])
// draft changes on every keystroke → new function on every keystroke
```

You added a hook, an array, and a lint rule to satisfy, and reproduced the behavior you already had.

## What it costs

Memoization is not free:

- Every `useCallback` allocates the array, stores the function, and runs a dependency compare on every render. Small but nonzero, and you pay it on *all* renders, including the ones that were already fine.
- Dependency arrays are a correctness hazard. An omitted dep gives you a stale closure — a handler holding last render's state. Those bugs are subtle and hard to trace.
- The code gets noisier. Every handler grows a wrapper and a dep list, and readers must decide which ones are load-bearing.

Applied blanket-style across a codebase, that is a guaranteed cost against a speculative benefit.

## When it is genuinely worth it

Reach for `useCallback` when one of these holds:

1. The child is wrapped in `React.memo` **and** rendering it is measurably expensive: a large list, a chart, a heavy tree.
2. The function is a dependency of another hook, usually a `useEffect`. Here stability is a *correctness* concern, not a performance one — an unstable function re-runs the effect every render, which can mean a re-subscribe or a refetch per keystroke.
3. You pass it to a hand-written hook that stores it in a dependency array.

People underrate case 2. It has nothing to do with re-renders, and it is often the only reason a `useCallback` in a codebase is necessary at all.

## Better first moves

Try the structural fixes before memoizing anything. They are usually larger wins and they need no maintenance.

- **Move state down.** If only one subtree uses a piece of state, put the state there. The parent stops re-rendering and the question disappears.
- **Pass children as props.** A component rendering `{children}` does not re-render those children when its own state changes, because the parent created the elements. That gets you memo-like behavior for free.
- **Split the component.** Fast-changing state next to expensive rendering is the real problem, and separating them fixes it at the root.

## And measure

Turn on "Highlight updates" in React DevTools, or use the Profiler, and find out what actually re-renders and what it costs. Most re-renders are cheap, because React is fast at re-rendering components that produce the same output. Optimizing a 0.3ms render is work you cannot detect afterward.

On React 19 with the compiler enabled, this is largely moot: it inserts memoization automatically and does a more thorough job than a human applying it by hand.

**Short version for your teammate:** wrapping everything in `useCallback` will not stop a single re-render unless the children are memoized, and it adds cost and stale-closure risk everywhere. Profile first, then memoize the two or three places that show up.
