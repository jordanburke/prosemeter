---
kind: eval-artifact
run: 4
variant: E
replicate: r1
task: T5
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
That won't work on its own. `useCallback` keeps the function reference stable, but the child re-renders anyway unless it's wrapped in `React.memo`.

A plain child component re-renders whenever its parent renders. Props don't enter into it. So a stable callback passed to an unmemoized child changes nothing, and you've added a dependency array to maintain for free.

`React.memo` is the piece that reads props. It shallow-compares them and skips the render when they all match. Only then does a stable function reference matter, because an inline arrow would fail the comparison every time.

Even together, the two often don't help. `useCallback` still runs on every render and still allocates the dep array, so you're trading a cheap allocation for a slightly more expensive one plus a comparison. For a child that renders a few DOM nodes, the memo check costs about as much as the render it prevents.

Where it does pay off:

- **The child is genuinely expensive** — a big list, a chart, a heavy tree.
- **The function is a dependency** of a child's `useEffect` or `useMemo`, where an unstable reference causes real re-work like re-subscribing.
- **You've measured it** in the React Profiler and seen the render time.

One catch worth knowing: `useCallback` only helps if the *other* props are stable too. One inline `style={{...}}` or `items={data.filter(...)}` in the same JSX breaks the memo comparison and wastes the whole effort.

My suggestion: profile first and find the components that actually cost something. Fix those. If the React Compiler is an option for your version, turn it on and let it handle memoization instead of hand-writing it everywhere.
