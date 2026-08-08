---
kind: eval-artifact
run: 3
variant: E
replicate: r3
task: T4
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You're leaking websocket subscriptions. The effect resubscribes without tearing down the old subscription, so handlers pile up and every message runs all of them.

The page slows down in proportion to how many times the effect has run. That's the signature: gradual degradation the longer the tab stays open, worse after navigation or heavy interaction.

Two causes, usually together:

**1. No cleanup function.** The effect subscribes but returns nothing, so React has no way to unsubscribe when it re-runs or when the component unmounts.

```tsx
// broken
useEffect(() => {
  socket.on("message", handleMessage)
}, [roomId])

// fixed
useEffect(() => {
  socket.on("message", handleMessage)
  return () => socket.off("message", handleMessage)
}, [roomId])
```

**2. An unstable dependency.** If a dep is an object, array, or function created fresh on each render, it's a new reference every time, so the effect re-runs every render. With cleanup missing, that's one leaked handler per render — which is why it gets bad fast.

```tsx
// re-runs every render: options is a new object each time
useEffect(() => { ... }, [options])
```

**How to confirm it.** Open DevTools, take a heap snapshot, interact for a minute, take another, and compare retained objects. Growing handler or closure counts confirm it. Faster check: log inside the effect and watch the count climb.

**How to fix it properly:**

- Return a cleanup function from every effect that subscribes, sets a timer, or adds a listener. No exceptions.
- Make the handler stable, or reference the latest one through a ref so the effect doesn't depend on it.
- Keep deps to primitives — `roomId`, not `room`.
- Turn on StrictMode in dev. It double-invokes effects on mount, which surfaces missing cleanup immediately instead of in production.

Also check whether you meant to open one socket per component at all. A single connection in a provider, with components subscribing to topics on it, is usually the right shape.
