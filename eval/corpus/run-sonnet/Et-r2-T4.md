---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r2
task: T4
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect is opening a new connection or listener without closing the old one. Each render (or each time a dependency changes) adds another, so the page does more work the longer it stays open.

Two common causes:

1. **No cleanup function.** `useEffect` should return a function that tears down what it set up — closes the socket, removes listeners. Without it, React never cleans up on unmount or re-run, so old connections pile up.
2. **Wrong dependency array.** If the effect depends on a value that changes often (an object or function recreated each render), it re-runs on every render, opening a fresh socket each time — even with cleanup, you're now churning connections instead of leaking them outright, and the ramp-up cost still adds up.

Fix:

```jsx
useEffect(() => {
  const socket = new WebSocket(url)
  socket.onmessage = handleMessage
  return () => socket.close()
}, [url])
```

Check three things: the dependency array only lists values that should trigger a reconnect, the cleanup function actually closes the socket, and any listeners you attach (`addEventListener`, event emitters) get removed in that same cleanup. Open the browser's Network tab under WS — if you see the connection count climbing instead of staying at one, that confirms the leak.
