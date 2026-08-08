---
kind: eval-artifact
run: 4
variant: E
replicate: r2
task: T4
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect is subscribing more than once and never unsubscribing. Each run adds a listener, the old ones stay alive, and every message now runs a growing pile of handlers.

Two things usually cause it together.

**No cleanup function.** The effect returns nothing, so React has no way to tear down the subscription when the component unmounts or the effect re-runs. Return a function that closes the socket or removes the listener.

**A dependency that changes every render.** If the dep array holds an object, an array, or an inline function, it is a new reference each render, so the effect re-runs constantly. That turns a missing cleanup into a leak that grows with every render, not just every mount.

The fix:

```tsx
useEffect(() => {
  const socket = new WebSocket(url)
  socket.addEventListener("message", onMessage)
  return () => {
    socket.removeEventListener("message", onMessage)
    socket.close()
  }
}, [url])
```

Keep the dep array to primitives — `url` here, not a config object. If you need the latest callback without re-subscribing, stash it in a ref and read `ref.current` inside the handler.

To confirm it before you change anything, log in the effect body and in the cleanup. If you see setups pile up with no matching teardowns, that is your leak. Chrome DevTools' memory profiler will show the retained listeners too.
