---
kind: eval-artifact
run: 1
variant: G
replicate: r1
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect is leaking subscriptions. It almost certainly re-runs on every render, opens a new websocket handler each time, and never closes the old one. After an hour you have hundreds of live listeners, all firing on every message, all holding memory. That's the slow creep.

Two bugs usually cause it, and you may have both.

**No cleanup function.** The effect subscribes and returns nothing, so React has no way to undo it:

```tsx
// broken
useEffect(() => {
  socket.on("message", handleMessage)
}, [roomId])
```

Return an unsubscribe. React calls it before the next run and on unmount:

```tsx
useEffect(() => {
  socket.on("message", handleMessage)
  return () => socket.off("message", handleMessage)
}, [roomId])
```

Note that `off` needs the same function reference you passed to `on`. An inline arrow in each spot creates two different functions, so the removal silently does nothing.

**An unstable dependency.** If the dep array holds an object, array, or function built during render, it's a fresh reference every time, so the effect tears down and rebuilds constantly:

```tsx
useEffect(() => { ... }, [{ roomId }])       // new object every render
useEffect(() => { ... }, [options])           // same, if options is inline
```

Depend on primitives — `[roomId]` — or wrap the value in `useMemo` / the handler in `useCallback`.

**How to confirm it in a minute:** log inside the effect and inside the cleanup. If you see subscribes stacking up with no matching unsubscribes, that's your answer. Chrome DevTools memory profiler works too: take a heap snapshot, leave the page for five minutes, take another, and compare listener counts.

One thing to rule out first. If this is React 18 in dev with StrictMode, effects intentionally run twice on mount to surface exactly this bug. Two subscriptions is the check working. Hundreds is the real leak.
