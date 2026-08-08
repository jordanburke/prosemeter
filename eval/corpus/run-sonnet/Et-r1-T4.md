---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r1
task: T4
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect is likely missing a cleanup function, so every time it re-runs it opens a new websocket connection or adds a new listener without closing the old one. The old connections stay alive, still receiving messages and still holding memory, so the page does more work with each passing minute — that's the slowdown.

This usually happens one of two ways:

- The effect has no `return` cleanup at all, so on unmount (or re-run) the socket is never closed.
- The dependency array includes something that changes often (an object or function recreated on every render), so the effect tears down and re-subscribes far more than intended — and if the teardown is missing or wrong, each cycle leaks a connection.

Fix it like this:

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

Check three things: the cleanup function exists and actually closes the socket, the dependency array only lists values that should trigger a reconnect, and `handleMessage` is stable (wrap it in `useCallback` or define it outside the effect) so it isn't recreated every render and forcing needless teardown cycles.
