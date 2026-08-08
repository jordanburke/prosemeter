---
kind: eval-artifact
run: 4
variant: Et
replicate: r2
task: T5
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work on its own. `useCallback` alone stops nothing.

A child re-renders when its parent re-renders. That is the default, and prop identity has nothing to do with it. React only compares props when the child is wrapped in `React.memo`. Without that wrapper, you can pass the same function reference forever and the child still re-renders every single time.

So the minimum is two pieces: `React.memo` on the child, and stable references for **every** prop it takes. Miss one and the memo check fails and you are back where you started. The usual culprits are the ones nobody thinks of as functions:

```tsx
<Child onClick={handleClick} style={{ margin: 8 }} items={data.filter(isActive)} />
```

`handleClick` is memoized. The object literal and the filtered array are new on every render, so `memo` bails out and the `useCallback` bought nothing.

There is a second trap. `useCallback` returns a new function whenever its own deps change. If a dep is itself unstable, the hook is pure overhead — you pay the comparison cost and get a fresh reference anyway.

**What I would do instead.** Render first, measure second. Open the React DevTools Profiler, record an interaction that feels slow, and look at what actually costs time. Most re-renders are cheap — React diffs, finds nothing changed, and touches no DOM. Memoizing a component that renders in 0.2ms makes the app slower, not faster, because you added a comparison and a cache entry to save nothing.

Blanket `useCallback` also costs you in review. It buries the three places where memoization genuinely matters under two hundred places where it does not, so nobody can tell which ones are load-bearing.

If your team is on React 19 with the compiler on, this gets settled for you — it inserts memoization where it pays off. Worth checking before doing any of it by hand.
