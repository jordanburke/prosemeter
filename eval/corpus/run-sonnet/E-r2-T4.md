---
kind: eval-artifact
run: sonnet
variant: E
replicate: r2
task: T4
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
The `useEffect` is likely opening a new websocket connection on every re-render without closing the old one. Each leftover connection keeps its listeners alive, so memory and work pile up the longer the page stays open.

This usually happens one of two ways:

1. **Missing cleanup function.** The effect opens the socket but never returns a function that closes it. If the effect re-runs (component re-renders with changed deps, or React Strict Mode double-invokes it in dev), you get a second socket while the first one still runs.
2. **Missing or unstable dependencies.** If the effect depends on a value that changes every render (like an inline object or function), it tears down and re-subscribes every render — and if the teardown isn't wired up right, old subscriptions never actually close.

**Fix:**

```jsx
useEffect(() => {
  const socket = new WebSocket(url)
  socket.onmessage = handleMessage
  return () => socket.close() // cleanup — runs before next effect and on unmount
}, [url]) // only reconnect when the url actually changes
```

Also check `handleMessage` — if it updates state on every message without care, and the component re-renders and re-subscribes because of an unstable dependency, you get compounding listeners on top of compounding renders.

**To confirm:** open dev tools, watch the Network tab's WS connections while the page sits idle. If the count climbs instead of staying at one, that's the leak.
