---
kind: eval-artifact
run: 2
variant: E
replicate: r3
task: T5
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work on its own. `useCallback` keeps the function identity stable, but a plain child re-renders whenever its parent does, no matter what props it got. So you would pay the cost of `useCallback` everywhere and get nothing back.

Here is the missing half. React re-renders every child when the parent renders. It does not compare props first. Only `React.memo` makes a child compare its props and skip the render when they are all equal.

So the two pieces work as a pair:

```js
const Child = React.memo(function Child({ onSave }) { ... })

// parent
const handleSave = useCallback((id) => save(id), [])
return <Child onSave={handleSave} />
```

`React.memo` does the skipping. `useCallback` stops a fresh function identity from defeating it on every render. Neither one helps alone.

Two more things that will bite even with both in place.

**Other unstable props.** An inline object or array — `style={{ margin: 8 }}`, `items={data.filter(...)}` — is a new reference every render, so the memo comparison fails and the child renders anyway. Every non-primitive prop has to be stable.

**Unstable dependencies.** `useCallback` returns a new function whenever its dependency array changes. If a dep is itself unstable, the callback is unstable too, and you have just added overhead.

My advice: do not do this by default. `useCallback` is not free — it allocates the array, compares deps, and adds noise to every component. Profile first, find the components that actually render often and cost real time, and memoize those. Blanket memoization usually makes the code harder to read and the app no faster.

Worth knowing: the React Compiler handles this automatically, so if you are on React 19 and can enable it, that is the better path than hand-writing `useCallback` everywhere.
