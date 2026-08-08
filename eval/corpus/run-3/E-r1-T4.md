---
kind: eval-artifact
run: 3
variant: E
replicate: r1
task: T4
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect is opening a new websocket subscription without closing the old one. Each render adds a listener, none of them go away, and every message now runs the handler N times.

The cause is almost always a missing cleanup function, a dependency array that changes on every render, or both.

```js
// leaks
useEffect(() => {
  socket.on("message", handleMessage)
}, [handleMessage])
```

Two problems there. The effect never unsubscribes, so subscriptions pile up. And if `handleMessage` is defined inline in the component, it is a new function every render, so the effect re-runs every render and the pile grows fast. That matches your symptom exactly — slow at first, worse the longer the page stays open.

The fix is to return a cleanup function that undoes whatever the effect did:

```js
useEffect(() => {
  const handler = (msg) => { /* ... */ }
  socket.on("message", handler)
  return () => socket.off("message", handler)
}, [socket])
```

Pass the *same function reference* to `off` that you gave to `on`. Calling `socket.off("message", someOtherFunction)` removes nothing and looks like it works.

Then check the deps array. It should hold only values the subscription itself depends on — the socket, a room id, a user id. If a function has to be in there, wrap it in `useCallback` so its identity is stable, or move it inside the effect as above. Anything that changes identity every render will tear down and rebuild the socket on every render, which is its own kind of slow.

To confirm this is what is happening: log inside the effect body and inside the cleanup. You should see them alternate one-for-one. If you see ten setups and zero teardowns, that is your leak.

Two other things worth checking once the leak is fixed. If the handler does `setMessages(prev => [...prev, msg])` and never trims, the array grows without bound and rendering it gets slower — cap the list or virtualize it. And if you own the socket connection rather than sharing one, close it in cleanup, not just unsubscribe.

React StrictMode in dev mounts effects twice on purpose to surface exactly this bug. If it is on, you are seeing the problem earlier than your users would. That is a feature.
