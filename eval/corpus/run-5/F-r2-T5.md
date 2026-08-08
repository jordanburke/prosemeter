---
kind: eval-artifact
run: 5
variant: F
replicate: r2
task: T5
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
## Will wrapping every prop function in useCallback stop the re-renders?

Mostly no. For most children it will do nothing, and you will have added code and a small cost to every render.

`useCallback` keeps a function identical across renders instead of creating a new one each time. That only matters to a child that checks whether its props changed. An ordinary child never checks. When a parent re-renders, React re-renders all of its children, whatever the props are and whether they changed or not.

So a stable function prop only helps when something downstream compares props by identity. There are three such cases:

- The child is wrapped in `React.memo`, which skips the re-render when every prop is identical to last time.
- The function goes into a `useEffect` dependency array, where a new identity re-runs the effect.
- The function goes into a `useMemo` or another `useCallback` dependency array, where a new identity throws away the cached value.

Outside those, the wrapper is inert.

## What is the cost of doing it anyway?

`useCallback` is not free. Every call allocates the dependency array, compares it against the previous one, and holds the old function in memory. That cost is small — far smaller than a wasted render — but you pay it on every render of every component, including the ones where it buys nothing.

The bigger cost is that it fails quietly. Wrap the callback but leave a sibling prop like `style={{ margin: 8 }}` inline, and `React.memo` still sees a changed prop and re-renders anyway. Your teammate will have written the hooks, seen no improvement, and have no signal about why. Memoization only works when *every* prop is stable, so it is all-or-nothing per component.

## What should we do instead?

Measure first, then memoize the specific components that show up.

Open React DevTools, turn on the profiler's "record why each component rendered" setting, and interact with the slow part of the app. It names the components that re-render and the props that caused it. Usually a handful of components matter — a large list, a chart, a heavy table — and the rest are noise.

For those components, apply the whole treatment: `React.memo` on the child, `useCallback` on its function props, `useMemo` on its object and array props. Leave everything else plain.

Two structural fixes often beat memoization outright. Moving state down, so the frequently-changing state lives in a small component rather than a big one, shrinks the re-render instead of skipping it. Passing children through as a `children` prop lets a subtree keep its identity while its wrapper re-renders.

One note on tooling. The React Compiler inserts this memoization automatically and does it more accurately than people do. If you can adopt it, that is the better answer to the whole question.
