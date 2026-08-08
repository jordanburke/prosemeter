---
kind: eval-artifact
run: 3
variant: B
replicate: r5
task: T5
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Mostly it won't, and it'll cost you readability for nothing. `useCallback` only helps under a specific condition that probably isn't met for most of your components.

Here's the thing people miss: **a plain child component re-renders when its parent re-renders, regardless of its props.** That's the default. React doesn't compare props and skip. So if you wrap a callback in `useCallback` and pass it to an ordinary child, the child still re-renders. You changed nothing except adding a line of code.

`useCallback` only pays off when the child is wrapped in `React.memo` (or is a dependency of another hook). `React.memo` is what makes React actually compare props and bail out. And that comparison is shallow, so it fails the moment one prop is a fresh reference — which is exactly what an inline arrow function is. So the two go together:

```jsx
const Child = React.memo(function Child({ onSave }) { ... })

// parent
const handleSave = useCallback(() => save(id), [id])
<Child onSave={handleSave} />
```

Break either half and you get nothing. `memo` without `useCallback` — memo always fails, child always re-renders. `useCallback` without `memo` — child re-renders anyway. And if you memoize the callback but *also* pass `style={{ margin: 8 }}` inline, that object is new every render and defeats the memo on its own.

The cost of doing it everywhere is real, if modest: every `useCallback` allocates and stores a function plus a dependency array, runs a comparison on each render, and adds a dependency list that will eventually go stale and cause a bug. Multiply by every prop in the app and you've made the code harder to read to buy a slowdown.

What I'd suggest instead: don't optimize by policy, optimize by measurement. Open the React DevTools Profiler, record an interaction that feels slow, and look at what's actually re-rendering and how long it takes. Usually the answer isn't "everything re-renders a bit" — it's one expensive component or one big list. Fix that specific thing with `memo` + `useCallback` together and leave the rest alone.

Worth knowing: if you're on React 19 with the compiler enabled, it does this memoization automatically and hand-written `useCallback` becomes largely redundant. Another reason not to sprinkle it manually.
