---
kind: eval-artifact
run: 2
variant: E
replicate: r3
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect is opening websocket subscriptions and never closing them. Each one stacks on the last, so handlers pile up and every message fires more work. That is why the page degrades with time rather than starting slow.

The usual shape:

```js
useEffect(() => {
  socket.on("update", handleUpdate)
}, [someValue])
```

No cleanup function. React runs the effect again whenever `someValue` changes, and each run adds another listener. Ten changes, ten listeners, ten times the work per message. The listeners also hold their closures, so old state stays in memory and never gets collected.

Return a cleanup function. React calls it before the next run and on unmount:

```js
useEffect(() => {
  const handleUpdate = (data) => setItems((prev) => [...prev, data])
  socket.on("update", handleUpdate)
  return () => socket.off("update", handleUpdate)
}, [someValue])
```

Pass the same function reference to `off` that you passed to `on`. An inline arrow in each spot creates two different functions, and `off` removes nothing.

Two things to check next.

**Your dependency array.** If it holds an object or a function defined in the component body, it gets a new identity every render, so the effect tears down and rebuilds the subscription on every single render. Wrap that dependency in `useMemo`/`useCallback`, or drop it from the array if the effect does not really need it.

**Unbounded state.** If the handler appends to an array that never gets trimmed, the page slows down even with perfect cleanup. Cap it — `prev.slice(-500)` — or move the history to a store that pages it.

To confirm the diagnosis, open the Performance panel, record while you use the page, and watch the listener count and heap size. Both climbing and never dropping means leaked subscriptions. Also note that React 18 StrictMode mounts effects twice in development on purpose, so a missing cleanup shows up immediately there.
