---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r3
task: T4
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect is leaking subscriptions. Every time it re-runs, it opens a new websocket listener without closing the old one, so listeners pile up the longer the page stays open — each incoming message now fires through every stale listener too, and the work grows without bound.

This almost always comes from a missing (or wrong) cleanup function:

```js
// Leaks: no cleanup, or a dependency array that changes often
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = handleMessage
}, [handleMessage]) // handleMessage is a new function every render
```

Two things to fix:

1. **Return a cleanup function that tears down the subscription.**

```js
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = handleMessage
  return () => ws.close()
}, [url])
```

2. **Check your dependency array.** If `handleMessage` or another dependency is a new object or function every render, the effect re-runs every render — open a socket, leak it, open another. Depend only on values that actually need to trigger a reconnect (usually just `url`), and wrap callbacks in `useCallback` if they must be in the array.

After the fix, open the page and watch the Network tab's WS frames, or log `ws.close()` calls — you should see exactly one open socket at a time, not one per render.
