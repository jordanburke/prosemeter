---
kind: eval-artifact
run: 5
variant: L
replicate: r4
task: T4
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect subscribes to the websocket again on every render and never unsubscribes. Subscriptions pile up, so each message runs more handlers than the last. Fix it by returning a cleanup function and stabilizing the dependencies.

The shape of the bug is this:

```js
useEffect(() => {
  socket.on("message", handleMessage)
})
```

No dependency array means the effect runs after every render. No return value means nothing tears the old listener down. After a hundred renders, one incoming message fires a hundred handlers. Each handler sets state, which renders, which adds another listener. The page gets slower the longer it stays open, exactly as you describe.

The fix has two parts.

Return a cleanup function. React calls it before re-running the effect and again when the component unmounts.

```js
useEffect(() => {
  socket.on("message", handleMessage)
  return () => socket.off("message", handleMessage)
}, [socket, handleMessage])
```

Pass the same function reference to `off` that you passed to `on`. An inline arrow is a new function each time, so `off` removes nothing.

Then make the dependencies stable. If `handleMessage` is defined in the component body, it is a new function every render, and the effect still re-runs every render — cleanly now, but wastefully. Wrap it in `useCallback`, or move it inside the effect. Same for the socket: create it once outside the component, or hold it in a `useRef`, or build it in a context provider above.

Confirm the diagnosis before you ship the fix. Log a counter in the effect body and watch it climb. Or open the memory profiler, take two heap snapshots minutes apart, and look for a growing count of closures.

One more thing worth checking. If your handler does `setMessages([...messages, m])`, the effect depends on `messages`, so it re-subscribes on every message. Use the updater form — `setMessages(prev => [...prev, m])` — and the dependency disappears.
