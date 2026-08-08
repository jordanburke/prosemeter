---
kind: eval-artifact
run: 5
variant: E
replicate: r2
task: T5
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
No, that will not work on its own. `useCallback` alone stops nothing, because a plain child component re-renders when its parent renders no matter what its props are.

React's default rule is that rendering a component renders its whole subtree. Props are not consulted. So a child re-renders on every parent render whether you passed it a stable function or a fresh one.

`useCallback` only matters once the child is wrapped in `React.memo`. `memo` makes the child compare its new props to its old ones by reference and skip the render when they all match. A new function identity every render defeats that comparison — so `useCallback` is what makes `memo` able to do its job. Neither works without the other.

That is the first half of the answer. The second half is that even the pair often does nothing useful.

`useCallback` is not free. It runs on every render, allocates the dependency array, and stores the function. You pay that cost every time, and you only get anything back on renders where a memoized child would have re-rendered and now does not.

One unstable prop cancels the whole thing. If the same child also receives `style={{ margin: 8 }}` or `items={data.filter(...)}` or `<Icon />` as children, that prop is new every render, `memo` bails out, and every `useCallback` around it was wasted.

Re-rendering is usually cheap anyway. A component that returns a few DOM elements costs microseconds. Skipping it saves nothing you can measure.

Here is what I would tell them to do instead.

Measure first. Open the React DevTools Profiler, record an interaction that feels slow, and look at what actually took time. Optimizing before that is guessing.

Then reach for cheaper fixes. Moving state down so fewer components sit under it usually beats memoizing. So does passing children through as a prop, since children rendered by the grandparent do not re-render when the middle component does.

Memoize the specific case the profiler found. That usually means one expensive subtree — a big list, a chart, a component doing real work in render — plus `useCallback` on the handlers it receives.

One thing worth checking. If the project is on React 19 with the React Compiler enabled, the compiler inserts this memoization automatically, and hand-written `useCallback` is largely redundant. Ask which version they are on before spending an afternoon on it.
