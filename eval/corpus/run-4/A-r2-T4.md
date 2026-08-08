---
kind: eval-artifact
run: 4
variant: A
replicate: r2
task: T4
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Almost certainly the effect is subscribing without unsubscribing, so you accumulate a new live subscription every time it re-runs. Old handlers never get torn down, they all keep firing on every message, and each one is holding a closure over stale state. Page gets slower and slower, and eventually you're doing N renders per message.

The shape to look for:

```tsx
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = (e) => setMessages((m) => [...m, JSON.parse(e.data)])
}, [url, user])   // no cleanup
```

Every time `url` or `user` changes identity, that runs again and opens another socket. Nothing closes the old one.

The fix is the cleanup function — the thing you return from the effect. React calls it before re-running the effect and again on unmount:

```tsx
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = (e) => setMessages((m) => [...m, JSON.parse(e.data)])
  return () => ws.close()
}, [url])
```

If you're subscribing to an emitter rather than owning the socket, same idea — the cleanup has to remove *the same function reference* you added:

```tsx
useEffect(() => {
  const handler = (msg) => setMessages((m) => [...m, msg])
  socket.on("message", handler)
  return () => socket.off("message", handler)
}, [socket])
```

Passing an inline arrow to both `on` and `off` is a common near-miss — the references differ, `off` removes nothing, and you've written cleanup code that does nothing.

Two things to check beyond the missing cleanup:

**Your dependency array.** If a dep is an object or function recreated on every render, the effect tears down and re-subscribes on every render. That's not a leak once cleanup exists, but reconnecting a websocket sixty times a second is its own problem. Memoize the dep or move the connection up to a context so there's one socket for the whole app.

**Unbounded state.** If you're appending every message to an array that never gets trimmed, the page slows down over time even with perfect cleanup — you're just rendering a list that grows without limit. Cap it (`m.slice(-500)`) or virtualize the list.

To confirm which one it is: open DevTools, Network tab, filter to WS, and leave the page sitting. One socket entry is healthy. A growing list is your answer. React DevTools Profiler will also show you the render count climbing per message if it's the handler pile-up.
