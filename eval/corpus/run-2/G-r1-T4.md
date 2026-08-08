---
kind: eval-artifact
run: 2
variant: G
replicate: r1
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect is opening a new websocket subscription every time it runs and never closing the old ones. They stack up, and each one keeps firing.

The shape looks like this:

```jsx
useEffect(() => {
  socket.subscribe(channel, handleMessage)
}, [channel, handleMessage])
```

No cleanup function. Every time the effect re-runs, you add another handler. After twenty re-runs, one incoming message triggers twenty handlers, each calling `setState`, each causing a render. That's the slowdown — it compounds because the extra renders can trigger more effect runs.

The fix is a cleanup function. React calls it before re-running the effect and once more on unmount:

```jsx
useEffect(() => {
  const sub = socket.subscribe(channel, handleMessage)
  return () => sub.unsubscribe()
}, [channel, handleMessage])
```

Now the count stays at one no matter how many times the effect runs.

Then check *why* it re-runs at all. A dependency that's a new object or function on every render makes the effect tear down and rebuild the subscription constantly, which is wasteful even with correct cleanup. `handleMessage` is the usual suspect — if it's defined in the component body, it's a new function identity every render. Either wrap it in `useCallback`, or move the handler inside the effect so it isn't a dependency:

```jsx
useEffect(() => {
  const sub = socket.subscribe(channel, (msg) => {
    setMessages((prev) => [...prev, msg])
  })
  return () => sub.unsubscribe()
}, [channel])
```

The functional `setMessages` update matters here — it keeps `messages` out of the dependency list, which would otherwise resubscribe on every message.

To confirm the diagnosis before you change anything, put a `console.log` in both the subscribe and the cleanup. Subscribes climbing with no matching cleanups is the leak. If they're balanced, it's something else and worth a heap snapshot.

Two related things to look at if this doesn't fully fix it:

- **Unbounded state.** If you're appending every message to an array that never gets trimmed, the page slows down as that array grows. Cap it if you only render recent messages.
- **Strict Mode in dev.** React 18 deliberately mounts, unmounts, and remounts effects in development to surface exactly this bug. If it only slows down in dev, that's the double-invoke, and correct cleanup handles it.
