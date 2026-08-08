---
kind: eval-artifact
run: 2
variant: E
replicate: r4
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect subscribes but never unsubscribes, so you stack up a new websocket listener every time it re-runs. Ten re-runs means ten live subscriptions, all firing handlers, all holding references to stale closures. The page gets slower because the work per message keeps growing.

**Fix it by returning a cleanup function from the effect:**

```js
useEffect(() => {
  const socket = new WebSocket(url)
  socket.addEventListener("message", handleMessage)

  return () => {
    socket.removeEventListener("message", handleMessage)
    socket.close()
  }
}, [url])
```

React calls that cleanup before every re-run and once on unmount. Old subscription goes away, new one takes its place, count stays at one.

**Then check your dependency array, because that decides how often the effect re-runs at all.** If a dependency is an object, array, or function created fresh during render, it is a new reference every time, so the effect tears down and rebuilds the socket on every render. Reconnecting a websocket that often is its own problem. Keep the array to primitives like `url`, or memoize the object with `useMemo`.

**Two things to confirm you actually have this bug:**

Open DevTools, go to the Network tab, filter to WS, and watch the connection count. One connection that stays open is healthy. A growing list is the leak.

Note that React 18's StrictMode mounts, unmounts, and remounts every component in development. That doubles your effect runs on purpose, to surface exactly this bug. If you see two connections in dev and one in production, that is StrictMode working, not a leak.

One more thing worth checking: if `handleMessage` calls `setState` with an array and appends to it without bound, the array grows forever and every render re-processes it. That produces the same "slower the longer it is open" symptom, and cleanup will not fix it. Cap the buffer.
