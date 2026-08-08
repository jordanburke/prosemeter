---
kind: eval-artifact
run: 2
variant: E
replicate: r1
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect subscribes but never unsubscribes, so subscriptions pile up. Every re-run adds one more listener, and the old ones keep firing.

The shape almost certainly looks like this:

```jsx
useEffect(() => {
  socket.on("message", handleMessage)
}, [someValue])
```

Each time `someValue` changes, React runs the effect again and attaches another handler. Nothing removes the previous one. After twenty renders you have twenty handlers, each doing a state update, each triggering a render. The page gets slower in proportion to how long it has been open, which matches exactly what you are seeing.

The fix is the cleanup function. Return it from the effect and React runs it before the next run and again on unmount:

```jsx
useEffect(() => {
  const handleMessage = (event) => { /* ... */ }
  socket.on("message", handleMessage)
  return () => socket.off("message", handleMessage)
}, [someValue])
```

Two details matter here:

- **Pass the same function reference to `off` that you passed to `on`.** An inline arrow function in each call creates two different references, so the removal silently does nothing.
- **Check your dependency array.** If it holds a value that changes on every render, the effect tears down and rebuilds the subscription constantly. That is wasteful even with correct cleanup. Wrap the handler in `useCallback` or move it inside the effect, which the version above does.

To confirm the diagnosis, log inside the effect and count the lines. If the count climbs as you use the page, this is your bug.

One more thing worth checking. If you open and close the actual websocket in this effect rather than reusing a shared one, close it in the cleanup too. Otherwise you leak sockets alongside the handlers.
