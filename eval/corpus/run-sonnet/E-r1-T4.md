---
kind: eval-artifact
run: sonnet
variant: E
replicate: r1
task: T4
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You likely have a leak: the effect opens a new websocket connection (or subscription) on every render, without closing the old one.

Here's how it happens. `useEffect` runs after every render where its dependencies changed — or every render, if you left the dependency array off. Each run opens a new connection. Without a cleanup function, the old connection stays open, still listening, still holding memory, still firing its message handler. After an hour of renders, you've got dozens of live sockets doing the same job, and each incoming message triggers dozens of handlers instead of one.

The fix has two parts:

1. **Return a cleanup function that closes the socket:**
```tsx
useEffect(() => {
  const socket = new WebSocket(url)
  socket.onmessage = handleMessage
  return () => socket.close()
}, [url])
```
2. **Lock down the dependency array.** Only re-run the effect when something that should actually reopen the connection changes — usually just the URL. If a function reference in your deps (like `handleMessage`) changes on every render, wrap it in `useCallback` or move it outside the effect, so it stops forcing needless reconnects.

Open your browser's Network tab and filter to WS. If you see the connection count climbing over time, that confirms the leak.
