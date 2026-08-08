---
kind: eval-artifact
run: sonnet
variant: A
replicate: r3
task: T4
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
The likely cause: your `useEffect` opens a websocket subscription but never closes the old one, so every time the effect re-runs, you stack another live connection and another set of listeners on top of the last. Nothing ever gets released, so memory and event-handling work grow the longer the page stays open.

Two common ways this happens:

1. **No cleanup function.** `useEffect` should return a function that closes the socket and removes listeners when the component unmounts or the effect re-runs. If that return is missing, every re-run leaves the old connection dangling.
2. **Unstable dependencies.** If the effect's dependency array includes something that changes on every render (an inline object, a new function reference, a value that isn't memoized), the effect tears down and re-runs constantly — and if cleanup is missing or incomplete, each cycle leaks a bit more.

Fix:

```jsx
useEffect(() => {
  const socket = new WebSocket(url)
  socket.addEventListener("message", handleMessage)

  return () => {
    socket.removeEventListener("message", handleMessage)
    socket.close()
  }
}, [url])
```

Then check the dependency array against what's actually stable. If `handleMessage` is redefined every render, wrap it in `useCallback` or move it outside the component, so the effect isn't re-subscribing when it doesn't need to.

If multiple components need the same socket, don't open one per component at all — hoist a single connection into a context or a store, and have components subscribe to messages from it instead of each opening their own.
