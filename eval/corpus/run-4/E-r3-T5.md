---
kind: eval-artifact
run: 4
variant: E
replicate: r3
task: T5
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It won't work on its own, and it'll cost you readability for nothing in most spots.

`useCallback` only stabilizes the function's identity. The child still re-renders whenever its parent does, because that's the default in React — a parent render re-renders its children regardless of whether props changed. You skip that only when the child is wrapped in `React.memo`. So `useCallback` without `memo` on the other side buys you zero.

Even with `memo`, one unstable prop kills it. If you also pass `style={{ margin: 8 }}` or `items={data.filter(...)}`, that object is new every render and the memo comparison fails. So the callback was stable and it still didn't matter.

And `useCallback` isn't free. It allocates, it stores the deps array, and it runs a comparison each render. For a child that renders a few DOM nodes, that costs more than the render you're avoiding.

What I'd do instead:

- Profile first. Open the React DevTools Profiler and find which components actually take time. It's usually two or three, not all of them.
- Memoize those, deliberately — `memo` on the child plus `useCallback`/`useMemo` on every prop it receives.
- Leave the rest alone.

The cases that genuinely need it: a child rendering a long list, a heavy chart, or a callback in the deps of another hook where an unstable identity causes a re-subscribe loop. That last one is a correctness fix, not a performance one, and it's worth doing every time.

React Compiler handles most of this automatically if we ever turn it on. Worth checking before we hand-write hundreds of these.
