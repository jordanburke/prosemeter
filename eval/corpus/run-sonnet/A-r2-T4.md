---
kind: eval-artifact
run: sonnet
variant: A
replicate: r2
task: T4
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your `useEffect` almost certainly opens a websocket connection without cleaning up the old one when it re-runs. Each re-run adds a new connection and a new set of event listeners, but the old ones never get torn down. Leave the page open long enough and you're holding dozens of live connections, each one still firing its message handler and updating state. That's your slowdown.

This usually happens one of two ways:

1. **Missing cleanup function.** The effect opens the socket but doesn't return a function that closes it.

```tsx
useEffect(() => {
  const socket = new WebSocket(url)
  socket.onmessage = handleMessage
  // no cleanup — socket never closes
}, [])
```

2. **Unstable dependencies.** The effect has a dependency (an object, a callback, or a value that's recreated on every render) so it tears down and re-subscribes far more often than intended — and if the cleanup is also missing, each of those extra runs leaks another connection.

The fix for the first case: return a cleanup function that closes the socket and clears the handler.

```tsx
useEffect(() => {
  const socket = new WebSocket(url)
  socket.onmessage = handleMessage
  return () => socket.close()
}, [url])
```

For the second case, check what's actually in your dependency array. If it includes a function or object literal defined inline in the component body, wrap it in `useCallback`/`useMemo` or move it outside the component, so the effect only re-runs when `url` (or whatever should actually trigger a reconnect) changes.

Quick way to confirm this is the cause: open dev tools, check the Network tab's WS filter, and watch the connection count climb as the page sits open.
