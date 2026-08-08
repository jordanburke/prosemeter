---
kind: eval-artifact
run: 2
variant: G
replicate: r4
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect subscribes but never unsubscribes, so the subscriptions pile up.

The effect runs again on every re-render where a dependency changed. Each run opens a new websocket subscription. Nothing closes the old one, so after an hour you have hundreds of live handlers, all firing on every message, all calling `setState`. Each message now triggers hundreds of renders, and each render adds another subscription. That is why the slowdown grows the longer the page stays open.

Return a cleanup function. React runs it before the next effect and once more on unmount:

```js
useEffect(() => {
  const sub = socket.subscribe(topic, onMessage)
  return () => sub.unsubscribe()
}, [topic])
```

That one `return` line usually fixes the whole thing.

Two follow-ups worth checking.

**Look at your dependency array.** If it holds an object or a function defined in the component body, it gets a new identity every render, so the effect tears down and rebuilds the socket on every render. Depend on primitives like `topic` and `userId`. Wrap the handler in `useCallback` only if it genuinely has to be a dependency.

**Guard against a late message after cleanup.** A message already in flight can land after you unsubscribe and call `setState` on a dead component:

```js
useEffect(() => {
  let live = true
  const sub = socket.subscribe(topic, (msg) => {
    if (live) setData(msg)
  })
  return () => {
    live = false
    sub.unsubscribe()
  }
}, [topic])
```

To confirm the diagnosis before you change anything, log the subscription count inside the effect and watch it climb. Or open DevTools, take two heap snapshots ten minutes apart, and look at the growth in retained handlers. Both take a minute and tell you whether this is the real cause.

One structural note: if several components need the same socket, move the connection into a context or a store and let components read from it. One subscription for the app beats one per mounted component, and it takes the whole class of bug off the table.
