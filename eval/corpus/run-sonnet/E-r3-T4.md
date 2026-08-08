---
kind: eval-artifact
run: sonnet
variant: E
replicate: r3
task: T4
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your `useEffect` is likely opening a new websocket connection or adding a new listener on every render, without closing the old one. Each render stacks another subscription on top of the last, so the page does more and more work the longer it stays open. That matches your symptom exactly.

Two common causes:

1. **Missing cleanup function.** If your effect opens a socket but doesn't return a function that closes it, React never tears down the old connection when the effect re-runs or the component unmounts.
2. **Wrong dependency array.** If the effect has no dependency array (runs every render) or depends on something that changes often (an object or function recreated each render), it re-fires far more than you intend — and each fire opens another connection if cleanup is missing.

The fix:

```js
useEffect(() => {
  const socket = new WebSocket(url)
  socket.onmessage = handleMessage
  return () => socket.close()   // cleanup: runs before the next effect and on unmount
}, [url])
```

Check the browser's Network tab under WS — if you see the connection count climbing instead of staying at one, that confirms it. Add the cleanup function, and tighten the dependency array so the effect only re-runs when `url` (or whatever it truly depends on) actually changes.
