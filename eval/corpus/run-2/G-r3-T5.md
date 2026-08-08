---
kind: eval-artifact
run: 2
variant: G
replicate: r3
task: T5
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work, and it will cost you. `useCallback` on its own stops nothing.

Here is why. A plain child component re-renders whenever its parent renders, no matter what the props are. React does not compare props unless you ask it to. So a stable function reference changes nothing — the child was never checking.

**`useCallback` only pays off when the child is wrapped in `React.memo`.** `memo` makes the child compare its props and skip the render when they all match. `useCallback` keeps the function prop from breaking that comparison. You need both, or you get neither.

And they have to line up. If the memoized child also takes an inline object or array — `style={{ color: "red" }}`, `items={[...]}` — that prop is new on every render, the comparison fails, and your `useCallback` did nothing.

**What the blanket approach actually costs:**

- Every `useCallback` runs on every render anyway. It allocates the deps array, compares it, and stores the result. That is more work than just making a function.
- The deps lists rot. Someone adds a variable to the function body, forgets the deps array, and now you have a stale closure reading last render's state. Those bugs are slow to find.
- The code gets harder to read for no gain.

**What to do instead.** Measure first. Open the React DevTools Profiler, record the slow interaction, and find the components that re-render often and take real time. That is a short list, usually.

Then fix those, in this order:

1. **Move state down.** If the state lives closer to where it is used, the big subtree stops re-rendering at all. This beats memoizing every time.
2. **Pass children as a prop.** A subtree passed through `children` does not re-render when the wrapper's state changes, because its element was created by the grandparent.
3. **Then reach for `memo` plus `useCallback`**, together, on the specific components that need it.

One exception worth keeping. A function in a `useEffect` dependency array needs a stable reference or the effect loops. Wrap that one regardless of rendering.

The React Compiler, if you can adopt it, does this memoization automatically and makes the whole debate moot.
