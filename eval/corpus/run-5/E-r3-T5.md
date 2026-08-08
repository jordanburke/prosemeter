---
kind: eval-artifact
run: 5
variant: E
replicate: r3
task: T5
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work, and it will cost you something. `useCallback` alone does not stop a child from re-rendering. It only stabilizes the function's identity. The child still re-renders whenever its parent does, because that is React's default.

Here is the rule your teammate is missing. When a component re-renders, React re-renders all of its children, no matter what the props look like. Props are not compared. The only way to skip a child is to wrap it in `React.memo`, which tells React to compare props and bail out when they are all equal.

So `useCallback` is half of a two-part technique. `memo` does the skipping. `useCallback` keeps the function prop referentially equal so that `memo`'s comparison can succeed — without it, a fresh function each render makes `memo` fail every time and do nothing but waste a comparison. Neither half works alone.

That means wrapping every callback while memoizing no children gets zero re-render savings. What it gets instead is real cost: an entry in the hook list per callback, a dependency array to compare on every render, and the previous function held in memory. It also gets bugs. A wrong dependency array leaves a stale closure that reads old state or old props, and that class of bug is much harder to find than a slow render.

Even the full pattern often fails, for two reasons.

`memo` compares props shallowly. If you also pass an object literal, an array, a style prop, or `children` as JSX, that prop is a new reference every render and the bailout never fires. The stable callback did nothing.

The child may not be expensive. Re-rendering a small component that returns a few DOM nodes is cheap — React does it in microseconds and only touches the DOM if the output changed. You spent complexity to save nothing.

Here is what to do instead.

Measure first. Open the React DevTools Profiler, record an interaction, and look at what actually takes time. Turn on "Highlight updates" to see what re-renders. Optimize what the profiler shows you, not what you suspect.

Move state down. If the state driving the re-render lives higher than it needs to, push it into the component that uses it. Fewer components re-render because fewer components subscribe.

Lift expensive children into `children`. Content passed as `children` is created by the outer component, so it keeps its identity when the middle component re-renders. This fixes whole subtrees with no memoization at all.

Then reach for `memo` plus `useCallback` on the specific components the profiler flagged — big lists, heavy charts, complex forms. Used there, deliberately, the pattern earns its keep.

One update. The React Compiler, stable as of React 19, inserts this memoization automatically and gets the dependencies right. If you can adopt it, hand-written `useCallback` becomes something you write rarely rather than everywhere.
