---
kind: eval-artifact
run: 5
variant: F
replicate: r4
task: T5
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
## Will wrapping every prop function in useCallback stop the re-renders?

No, not on its own. `useCallback` keeps a function's identity stable between renders, but a stable prop does not stop a child from re-rendering. A child re-renders whenever its parent re-renders, no matter what the props look like. The only thing that changes that is wrapping the child in `React.memo`, which tells React to skip the child when its props are unchanged.

So `useCallback` without `memo` on the child does nothing for rendering. It adds code and costs a little memory, and the child re-renders exactly as often as before.

## Why does the stable function matter at all, then?

It matters as the second half of a pair. `React.memo` compares the new props to the old ones by reference. An inline arrow function is a new reference on every render, so `memo` sees a changed prop and re-renders anyway — the memo is defeated.

```jsx
const Child = React.memo(function Child({ onSave }) { /* ... */ })

// memo never helps: onSave is a new function every render
<Child onSave={() => save(id)} />

// memo works: onSave keeps the same identity while id is unchanged
const onSave = useCallback(() => save(id), [id])
<Child onSave={onSave} />
```

`useCallback` only pays off where something downstream compares by reference. That means a `memo`'d child, a dependency array of another hook, or a stable value put into a context.

## Does a re-render actually cost anything?

Usually much less than people assume. A re-render means React calls your component function and compares the result to the previous tree. If nothing changed, React touches no DOM. The DOM work is the expensive part, and React already skips it.

So the honest answer is that most re-renders are not a problem worth solving. Reach for `memo` and `useCallback` when you have measured a real cost — a component that renders a long list, does heavy work in its body, or sits under a parent that renders on every keystroke.

## What does the "wrap everything" version cost?

It is not free, and the costs are quiet.

**Every hook runs.** `useCallback` allocates the callback, stores the dependency array, and compares it on each render. That is small, and it is not zero, and doing it hundreds of times is a real slice of your render.

**Dependency arrays go stale.** Miss a dependency and the callback closes over an old value, and you get a bug that shows up as "it used the previous state." Blanket-wrapping means writing many dependency arrays that nobody thinks hard about.

**The code gets harder to read.** A three-line handler becomes six lines and a list of dependencies. Reviewers now have to check the list is right.

## What should they do instead?

Measure first, then apply both halves where the measurement points.

Open the React DevTools Profiler, record the interaction that feels slow, and read which components rendered and how long each took. That tells you where the cost is, which is almost never where people guess.

For the components that show up, wrap the child in `memo` and the callbacks it receives in `useCallback` together. One without the other is wasted.

Before reaching for memoization at all, try the cheaper structural fixes. Move state down, so the fast-changing value lives in the smallest component that needs it. Pass children as a `children` prop, so the expensive subtree is created by a parent that does not re-render. These fixes remove renders instead of skipping them, and they leave no dependency arrays behind.

## The one-line version to send them

`useCallback` is only useful with `React.memo` on the receiving component — use both, on the components the profiler flags, and nowhere else.
