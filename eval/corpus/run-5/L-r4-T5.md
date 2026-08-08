---
kind: eval-artifact
run: 5
variant: L
replicate: r4
task: T5
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work. `useCallback` alone stops nothing, and applied everywhere it costs more than it saves.

Here is why it does nothing on its own. A normal React child re-renders whenever its parent re-renders. It does not compare props first. So a stable function prop changes nothing — the child was never going to skip the render.

`useCallback` only matters when something downstream compares props. That means the child is wrapped in `React.memo`, or the function feeds a `useEffect` dependency array, or it feeds another `useMemo`. Without one of those, you have added a dependency array and a cache lookup for no effect.

Even with `React.memo`, one unstable prop breaks it. `memo` compares every prop shallowly. An inline object like `style={{ margin: 8 }}`, an inline array, or a child element passed through `children` is a fresh reference each render, so the comparison fails and the child renders anyway. Stabilizing four props out of five buys nothing.

The cost is real, if small. Each `useCallback` allocates the dependency array, stores the previous one, and compares them every render. That is cheap per call and not free at a thousand.

The larger cost is bugs. A wrong dependency array captures a stale value, and the callback fires with data from three renders ago. Those are hard to find. Blanket-wrapping multiplies the chances of getting one wrong.

Do this instead. Profile first — open the React DevTools Profiler, record an interaction, and find the components that actually render often and cost real time. Then fix those, memoizing the child and stabilizing all its props together, as one change. Verify with the profiler that the render disappeared.

Also check whether the re-renders matter at all. A component that re-renders often and takes 0.2ms is not a problem worth code for.

One exception is worth knowing. The React Compiler, in React 19, inserts this memoization for you. If your project has it turned on, hand-written `useCallback` is mostly redundant.
