---
kind: eval-artifact
run: 4
variant: Et
replicate: r1
task: T4
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect subscribes but never unsubscribes. Every re-run adds another listener, and the old ones keep firing.

**What is happening**

```tsx
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = (e) => setMessages((m) => [...m, JSON.parse(e.data)])
}, [url])
```

When `url` changes, React runs the effect again. The old socket is still open, still receiving, still calling `setState`. After ten changes you have ten sockets and ten state updates per message. The page gets slower in proportion to how long it has been open, which matches what you are seeing.

React also runs effects twice on mount in StrictMode during development, so you start at two.

**The fix**

Return a cleanup function. React calls it before the next run and on unmount.

```tsx
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = (e) => setMessages((m) => [...m, JSON.parse(e.data)])
  return () => ws.close()
}, [url])
```

**Check your dependency array while you are in there**

If the array holds anything recreated each render — an options object, an inline callback — the effect tears down and rebuilds the socket on every render. That is a different bug with the same symptom, and cleanup alone will not fix it. Move the value outside the component, or wrap it in `useMemo`/`useCallback`, or reduce the dependency to a primitive.

**Two other leaks worth ruling out**

- **Unbounded message array.** If you append every message and never trim, memory grows even with one socket. Cap the list, or window it.
- **Stale closures over state.** `ws.onmessage` capturing `messages` directly instead of using the updater form pins every old array in memory. The `(m) => [...m, x]` form above avoids this.

**How to confirm**

Open DevTools, Network tab, filter to WS. If you see more than one open connection, that is your answer. Memory profiler, take two heap snapshots ten minutes apart, and compare — growing detached listeners point at the same thing.
