---
kind: eval-artifact
run: sonnet
variant: A
replicate: r1
task: T4
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
This is almost always a missing (or broken) cleanup in the `useEffect` that opens the websocket — connections or listeners are piling up over time instead of being replaced.

Common causes:
1. **No cleanup function.** The effect opens the socket and attaches handlers but never returns a function to close it. Every time the effect re-runs (remount, dependency change, strict-mode double-invoke in dev) it opens a new connection on top of the old one, and the old one just keeps sending messages into a component that's supposed to have moved on.
2. **Unstable dependencies.** If the effect's dependency array includes an inline object or function that's recreated every render, the effect tears down and resubscribes constantly. If cleanup is missing or buggy, listeners pile up fast.
3. **Unbounded message state.** Even with correct cleanup, if every incoming message gets appended to an array in state with no cap, the array — and the re-render cost — grows without bound the longer the page is open.

Fix:
```tsx
useEffect(() => {
  const socket = new WebSocket(url)
  socket.onmessage = handleMessage
  return () => socket.close()
}, [url])
```

- Always return a cleanup function that closes the socket / removes listeners.
- Keep the dependency array minimal and stable — no new object/function literals passed in each render.
- If you're accumulating messages in state, cap it (keep the last N) rather than appending forever.
- Check DevTools' Network tab — if you see multiple "101 Switching Protocols" connections stacking up over time, that confirms the leak is #1.
