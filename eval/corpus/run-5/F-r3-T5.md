---
kind: eval-artifact
run: 5
variant: F
replicate: r3
task: T5
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
## Will wrapping every callback prop in useCallback stop child re-renders?

No. On its own it stops nothing, because a plain child re-renders whenever its parent renders, no matter what the props are.

`useCallback` keeps a function the same object across renders instead of building a new one each time. That is all it does. It changes prop *identity*, not whether React renders the child.

React's default is simple: render a component, and it renders all of its children. It does not compare the new props against the old ones first. So a stable callback arrives at a child that was going to re-render regardless.

## What makes the memo actually work?

The child has to opt into prop comparison, and every prop has to be stable — not just the callback.

Wrap the child in `React.memo`. That tells React to compare the new props against the last ones and skip the re-render when they all match.

```jsx
const Row = React.memo(function Row({ item, onSelect }) { ... })
```

React compares by reference, the same check as `===`. Numbers and strings compare by value, so they are fine. Objects, arrays, and functions are new values each render unless you hold on to them, so any one of them breaks the match by itself.

That is the part your teammate's plan misses. This skips nothing:

```jsx
<Row item={item} style={{ padding: 8 }} onSelect={handleSelect} />
```

`handleSelect` is stable and `style` is not, so the comparison fails on `style` and the child renders anyway. One unstable prop cancels the whole thing. Children passed as `children` count too — JSX creates a new element object every render.

So the working combination is three things at once: `React.memo` on the child, `useCallback` on every function prop, and `useMemo` or a hoisted constant for every object and array prop. Two out of three buys nothing.

## Is it worth doing everywhere?

No — apply it where you have measured a cost, not by default.

Memoizing is not free. `useCallback` stores the function and its dependency array on every render, and compares that array each time. `React.memo` compares every prop on every parent render. For a small component that renders in well under a millisecond, the comparison can cost as much as the render it skips.

The maintenance cost is larger than the runtime cost. Dependency arrays drift out of sync with the code they guard, and a stale one causes a callback that reads old state — a real bug, and a hard one, traded for an invisible gain.

Reach for it when the profile says so:

- **A child that is genuinely expensive.** A chart, a big table, a component doing heavy work per render.
- **A long list of memoized rows.** Skipping five hundred cheap renders adds up, even when one is trivial.
- **A dependency of another hook.** A function in a `useEffect` dependency array must be stable, or the effect re-runs every render. Here `useCallback` fixes correctness, not speed, and it is not optional.

## What should we do instead?

Measure first, then fix the top cause.

Open React DevTools' Profiler, record the interaction that feels slow, and read which components rendered and how long each took. That tells you where the time went. Most "too many re-renders" complaints turn out to be one heavy component or state held too high in the tree, and neither is solved by memoizing everything below it.

Two structural fixes usually beat memoizing:

- **Move state down.** If only one subtree reads a value, keep the state in that subtree. Nothing above it renders when the value changes.
- **Pass children through instead of rendering them inside.** A component that receives `children` does not re-create them when its own state changes, because the parent that owns them did not render.

React's compiler, shipped with React 19, adds these memoizations automatically where they help. If you are on it, hand-written `useCallback` for performance is mostly redundant — another reason not to spend a week adding it by hand.
