---
kind: eval-artifact
run: 2
variant: G
replicate: r5
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect is almost certainly subscribing again on every render and never unsubscribing. Each run stacks another live listener on the socket, so the same message gets handled 2, then 5, then 50 times. That is why it gets slower the longer the page stays open.

Two things cause it, and you may have both.

**No cleanup.** If the effect does not return a function that tears the subscription down, nothing ever removes the old listener:

```jsx
useEffect(() => {
  const handler = (e) => setMessages((m) => [...m, e.data])
  socket.addEventListener("message", handler)
  return () => socket.removeEventListener("message", handler)
}, [])
```

The returned function is the whole fix for this half. React runs it before the next effect run and on unmount.

**An unstable dependency.** If your dep array holds an object, an array, or a function defined in the component body, it is a new value on every render, so the effect re-runs every render. Cleanup saves you from stacking listeners, but you are still tearing down and rebuilding a websocket subscription dozens of times a second, which is its own performance problem.

To find out which one you have, log inside the effect and count. If it fires once, your problem is elsewhere. If it fires on every render, look at the dep array.

How to fix each:

1. **Add the cleanup return.** Do this first, always. Remove the exact same handler reference you added, not a new inline arrow, or `removeEventListener` matches nothing.
2. **Stabilize the deps.** Wrap object and function deps in `useMemo` or `useCallback`, or move them out of the component entirely if they do not close over props or state.
3. **Use the functional setter.** `setMessages((m) => [...m, e.data])` instead of `setMessages([...messages, e.data])`. The second form needs `messages` in the dep array, which changes on every message, which re-runs the effect on every message.
4. **Check what you keep.** If you are appending every message to an array that never gets trimmed, the page slows down from the growing list on its own. Cap it, or window the render.

Also worth knowing: in dev, StrictMode mounts effects twice on purpose. That is not the bug, but it does surface missing cleanup fast, which is the point of it.
