---
kind: eval-artifact
run: 5
variant: F
replicate: r5
task: T5
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
## Will wrapping every prop function in useCallback stop child re-renders?

No. On its own it does nothing at all, and applied everywhere it costs more than it saves.

`useCallback` keeps a function's identity stable across renders. It returns the same function object each time instead of a fresh one. That matters only to code that compares props by identity.

A plain child component does not compare props. When a parent renders, React renders its children, full stop. It does not check whether anything changed. So a stable function prop changes nothing — the child re-renders either way.

## What actually stops the re-render?

`React.memo` on the child. That is the piece your teammate is missing.

`memo` wraps a component and tells React to skip rendering it when its props are equal to last time, compared by identity. Now identity matters, and now a stable function helps.

The two work as a pair. `memo` without `useCallback` fails, because a fresh inline function is a new prop every render and the memo check never passes. `useCallback` without `memo` is dead weight, because nothing is checking. You need both, on the same boundary, or neither does anything.

Every other prop has to be stable too. One inline object — `style={{ color: "red" }}` — is a new value each render and defeats the memo check by itself, no matter how many callbacks you wrapped.

## What does it cost to do it everywhere?

More than nothing, in three ways.

`useCallback` is not free at runtime. React stores the function and its dependency array, then compares the array on every render. That is real work, and for a cheap child it is more work than just re-rendering.

The dependency array is a correctness risk. Miss a dependency and the callback closes over a stale value — an old piece of state, an old prop — and you get a bug that only shows up under specific timing. Stale closures are much harder to find than a redundant render.

The code gets noisier. Every handler grows a wrapper and an array someone has to maintain when the function changes.

## So what should I tell them?

Measure first, then apply both tools together at a few chosen places.

Open the React Profiler and record an interaction that feels slow. It shows which components rendered and how long each took. Most re-renders cost under a millisecond and no user will ever perceive them.

Fix the ones that show up. The candidates are large lists, components that run expensive work during render, and subtrees that re-render on every keystroke in a parent. Wrap that child in `memo`, wrap the functions it takes in `useCallback`, and stabilize its other props too.

One more option worth knowing: if you are on React 19 with the compiler enabled, it inserts this memoization for you, and hand-written `useCallback` becomes redundant.
