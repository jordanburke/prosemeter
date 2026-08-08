---
kind: eval-artifact
run: 5
variant: F
replicate: r1
task: T5
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work, and it will cost you readability and a little speed. `useCallback` alone stops nothing. It only helps when the child is wrapped in `React.memo`, and even then only if every *other* prop is stable too. Blanket-wrapping is the version of this idea that reliably fails.

## Why does useCallback alone not stop re-renders?

React re-renders a child whenever its parent re-renders. That is the default, and props have nothing to do with it. React does not compare props to decide whether to render — it just renders.

`useCallback` returns the same function object across renders instead of a fresh one. That is all it does. A stable function object changes nothing, because nobody is checking.

The check only exists if you add it. `React.memo(Child)` wraps a component so React shallow-compares its props and skips the render when they are all equal. **Shallow compare** means it checks each prop with `Object.is` — same reference for objects and functions, same value for strings and numbers. It does not look inside.

So the mechanism needs both halves. `memo` does the skipping. `useCallback` makes one prop eligible to be skipped over. Without `memo`, `useCallback` is pure overhead.

## What breaks it even when memo is there?

Any other unstable prop. `memo` skips the render only when *every* prop compares equal, so one fresh object undoes all your careful callback wrapping:

```jsx
<Child onSave={stableCallback} style={{ margin: 8 }} items={data.filter(Boolean)} />
```

The object literal and the new array are both new objects on every render. `memo` sees them as changed and renders. Your `useCallback` did nothing.

`children` is the one people miss. JSX children are new elements each render, so a memoized component with JSX children almost never skips.

And `useCallback` itself needs a correct dependency list. If a dependency changes every render, the callback changes every render, and you are back where you started with extra code.

## What does it actually cost?

Every `useCallback` is a hook call, a dependency array allocated per render, and a comparison. That is small but real, and it is paid on every render whether or not it helps.

The larger cost is the code. Dependency arrays go stale. A missing dependency gives you a callback closing over old state, which produces a bug that looks like nothing and takes an afternoon to find. Wrapping a hundred functions means a hundred chances at that.

## What should we do instead?

**Measure first.** Turn on the React DevTools Profiler and record the interaction that feels slow. It shows which components rendered and how long each took. Optimize what shows up. Most re-renders are cheap enough to ignore — a component that renders in under a millisecond is not your problem, even if it renders often.

**When something real shows up, memoize a boundary, not every function.** Find the one expensive subtree, wrap that component in `memo`, and stabilize all of its props — callbacks with `useCallback`, objects and derived arrays with `useMemo`. One deliberate boundary beats a hundred scattered wrappers.

**Prefer moving state down to memoizing around it.** If the state driving the re-render lives higher than it needs to, push it into the component that uses it. Then the expensive siblings never re-render and no memoization is needed.

**Do wrap callbacks that are effect dependencies.** A function passed into a `useEffect` dependency list should be stable, or the effect re-runs every render. That is a correctness reason, and it is worth doing regardless of speed.

One more thing worth knowing: the React Compiler, shipped as stable in React 19.1, inserts this memoization automatically. If you adopt it, hand-written `useCallback` becomes redundant. That is another argument for waiting until you have a measurement before writing a hundred of them by hand.
