---
kind: eval-artifact
run: 4
variant: Et
replicate: r2
task: T4
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect subscribes again on every render and never unsubscribes. Subscriptions pile up. After an hour you have hundreds of live handlers, each one firing on every message and each one triggering a render that adds another subscription. That is the slowdown, and it is also a memory leak.

Two bugs usually cause it, and you may have both.

**No cleanup function.** `useEffect` unsubscribes only if you return a function that does it:

```ts
useEffect(() => {
  const socket = new WebSocket(url)
  socket.addEventListener("message", handleMessage)
  return () => {
    socket.removeEventListener("message", handleMessage)
    socket.close()
  }
}, [url])
```

**An unstable dependency.** If your dep array holds a handler, an options object, or an array literal defined in the component body, React sees a new value every render and re-runs the effect every render. Cleanup running is not enough here — you are still tearing down and rebuilding a websocket 60 times a second. Wrap the handler in `useCallback`, or better, keep it in a ref and leave it out of the deps entirely. Only primitives that genuinely identify the connection belong in that array.

**Check this next.** Open DevTools, go to the Network tab, filter to WS, and count the connections. One means your deps are fine and you only need cleanup. Many means you have the dependency problem too.

One more thing to rule out while you are looking. If you append every incoming message to state, that array grows without bound and re-renders get slower on their own. Cap it — keep the last N, or move the history out of render state.
