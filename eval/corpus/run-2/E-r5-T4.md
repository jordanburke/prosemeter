---
kind: eval-artifact
run: 2
variant: E
replicate: r5
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect is almost certainly subscribing again on every render without unsubscribing, so subscriptions pile up and each message gets handled more times as the page ages.

The two shapes that cause this:

**No cleanup function.** The effect opens the socket or adds a listener and returns nothing. React has no way to undo it, so the old subscription stays live alongside the new one.

**A dependency that changes identity every render.** An inline object, an array literal, or a function defined in the component body is a new value each time, so the effect tears down and re-runs constantly — and if cleanup is missing or partial, the leak compounds.

The fix is to return a cleanup that undoes exactly what the effect did:

```tsx
useEffect(() => {
  const socket = new WebSocket(url)
  const onMessage = (e: MessageEvent) => setData(JSON.parse(e.data))
  socket.addEventListener("message", onMessage)

  return () => {
    socket.removeEventListener("message", onMessage)
    socket.close()
  }
}, [url])
```

Three things to check while you are in there.

**Keep the dependency array to primitives.** `url` is a string, so it compares by value. If you are passing a config object, either destructure the fields you need or hold it in a ref.

**Remove the listener with the same function reference you added.** `removeEventListener` matches by identity, so an inline arrow in both places removes nothing.

**Guard against a message arriving after unmount.** If the socket closes asynchronously, a late handler can call `setState` on a dead component. A `let cancelled = false` flag set in cleanup handles it.

To confirm the diagnosis before you change anything: log inside the effect body and inside the cleanup. If you see many "subscribed" lines and few "cleaned up" lines, that is your leak. In development React runs effects twice on mount on purpose — expect one extra pair, not a growing count.

Chrome DevTools will also show it. Open the Network tab, filter to WS, and watch the connection count climb.
