---
kind: eval-artifact
run: 5
variant: L
replicate: r3
task: T4
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect almost certainly opens a new websocket subscription without closing the old one, so subscriptions pile up as the page runs. Fix it by returning a cleanup function from the effect and getting the dependency array right.

Here is the mechanism. `useEffect` runs after render. React runs it again whenever a value in the dependency array changes, and it runs the cleanup function you return *before* each re-run and once on unmount. If you return nothing, there is no cleanup, and each run leaves its predecessor alive.

So a component that re-renders often ends up with ten, then a hundred, then a thousand live handlers. Every incoming message now fires all of them. Each one calls `setState`, which triggers another render, which runs the effect again. The page gets slower in proportion to how long it has been open, which is exactly the symptom you describe.

Two versions of the bug are common.

**No cleanup at all.** The effect subscribes and returns nothing.

**A cleanup that unsubscribes the wrong thing.** The effect captures a handler that is a fresh function on every render, so `off(handler)` removes a function the emitter never registered. The listener list keeps growing.

A missing or wrong dependency array makes either one worse. With no array, the effect runs after *every* render. With an array holding an object or function defined in the component body, the identity changes each render and the effect runs every time anyway.

The correct shape:

```js
useEffect(() => {
  const socket = new WebSocket(url)
  const onMessage = (event) => setMessages((prev) => [...prev, JSON.parse(event.data)])
  socket.addEventListener("message", onMessage)
  return () => {
    socket.removeEventListener("message", onMessage)
    socket.close()
  }
}, [url])
```

Three things are load-bearing there. The handler is defined inside the effect, so subscribe and unsubscribe name the same function. The cleanup closes the socket, not just the listener. The dependency array holds only `url`, a string, so identity is stable.

Two more traps.

**Stale state in the handler.** Use the updater form of `setState` — `setMessages(prev => ...)` — so the handler does not close over a stale value and you do not need to add state to the deps.

**Late messages after cleanup.** If you do async work, guard with a flag: set `let cancelled = false`, set it true in cleanup, and check it before calling `setState`.

In React 18 Strict Mode in development, React mounts, unmounts, and remounts every component on purpose. That double-invocation is a feature — it surfaces exactly this bug. If your app misbehaves under Strict Mode, the effect is not cleaning up properly.

To confirm the diagnosis, log in both the setup and the cleanup and watch whether the counts stay balanced. Or open Chrome DevTools, take two heap snapshots minutes apart, and look for a growing count of listener or socket objects.

For anything beyond a single connection, move the socket out of the component. A module-level singleton with reference counting, or a library like `react-use-websocket`, means one connection for the whole app no matter how many components read from it.
