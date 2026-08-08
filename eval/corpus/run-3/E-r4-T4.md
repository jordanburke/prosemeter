---
kind: eval-artifact
run: 3
variant: E
replicate: r4
task: T4
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect subscribes on every run and never unsubscribes. Each render adds another live websocket listener, and the old ones keep firing. Ten renders in, ten handlers respond to every message, and each one triggers a state update that causes another render.

Two bugs usually sit together here.

**The missing cleanup.** Return a function from the effect, and React calls it before the next run and on unmount:

```js
useEffect(() => {
  const socket = new WebSocket(url)
  socket.addEventListener("message", handleMessage)
  return () => socket.close()
}, [url])
```

**The unstable dependency.** If the dep array holds an object, array, or function defined in the component body, it gets a new identity every render, so the effect tears down and rebuilds the socket constantly. Depend on primitives like `url`, or wrap the handler in `useCallback` and keep its own deps stable.

Confirm it before you change anything. Open DevTools, go to the Network tab, filter to WS, and watch the connection count while you interact with the page. A number that climbs is your answer. The Memory tab's heap snapshots will also show detached listeners piling up.

One more thing to check: if `handleMessage` appends to an array in state and nothing ever trims it, the page slows down from the growing array rather than the sockets. Cap the buffer if that turns out to be the cause.
