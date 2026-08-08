---
kind: eval-artifact
run: 2
variant: Ep
replicate: r2
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You are almost certainly leaking websocket subscriptions. Your `useEffect` subscribes, but it never unsubscribes, so every time the effect re-runs you add another live listener on top of the old ones.

Here is the shape of it. An effect runs on mount and again whenever a value in its dependency array changes. If the effect opens a subscription and returns nothing, React has no way to close it. The old subscription stays alive, holding a reference to the closure it was created in — which holds the state, the props, and the component tree from that render. Ten re-runs later you have ten sockets or ten handlers, each firing on every message, each calling a `setState` that triggers another render. The page gets slower and slower because the work per message keeps growing.

Two symptoms confirm it. Messages get handled more than once — duplicated list items, counters jumping by 2 then 3 then 4. And memory climbs steadily in the DevTools memory profiler while the tab sits idle.

**The fix is a cleanup function.** Return one from the effect, and React calls it before the next run and on unmount:

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

Now check the dependency array, because that is usually the second half of the bug. If a dependency is a value recreated on every render — an object literal, an inline function, an array built in the body — the effect tears down and rebuilds the socket on every single render. That is not a leak, but it is worse in its own way: you are churning connections constantly. Depend on primitives like `url`, and wrap any handler you must depend on in `useCallback`, or move it inside the effect.

One more thing to watch. In development, React 18+ Strict Mode mounts every component twice on purpose to surface exactly this bug. If you see two connections in dev and one in production, the cleanup is working and you can ignore it.
