---
kind: eval-artifact
run: 2
variant: E
replicate: r2
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You are almost certainly leaking websocket subscriptions. The effect re-runs, subscribes again, and never tears down the old subscription. Every re-run adds another live listener, so the page does more work the longer it stays open.

Two things cause this, and you may have both.

**No cleanup function.** The effect needs to return one:

```tsx
useEffect(() => {
  const socket = connect(url)
  socket.on("message", handleMessage)
  return () => {
    socket.off("message", handleMessage)
    socket.close()
  }
}, [url])
```

Without the return, React never unsubscribes, and the listeners stack up.

**An unstable dependency.** If the dependency array holds an object, array, or function created fresh on each render, React sees a new value every time and re-runs the effect on every render. That is the fast version of the same leak. Move the value outside the component, memoize it with `useMemo` or `useCallback`, or depend on the primitive inside it instead of the whole object.

To confirm which one you have, log inside the effect and inside the cleanup. If you see subscribes with no matching unsubscribes, it is the missing cleanup. If you see both running constantly, it is the unstable dependency.

Then check the handler itself. A handler that appends to state without a cap grows the array forever, and re-rendering a list of a hundred thousand messages will slow the page down even with the subscription fixed. Cap the buffer, or window the list.

React StrictMode in development mounts effects twice on purpose, exactly to surface missing cleanup. Turn it on if it is off.
