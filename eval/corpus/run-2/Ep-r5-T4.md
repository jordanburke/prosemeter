---
kind: eval-artifact
run: 2
variant: Ep
replicate: r5
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect is subscribing more than once and never unsubscribing. Each render adds a listener, the old ones stay alive, and every incoming message now runs N handlers instead of one. That is why it degrades with time rather than being slow from the start.

The usual shape of the bug:

```tsx
useEffect(() => {
  socket.on("message", handleMessage)
}, [someValue]) // no cleanup
```

Every time `someValue` changes, React runs the effect again and attaches another handler. Nothing ever detaches. After an hour of updates you have hundreds of handlers, each calling `setState`, each triggering a render.

**Return a cleanup function.** React calls it before re-running the effect and again on unmount:

```tsx
useEffect(() => {
  const handleMessage = (msg: Message) => setMessages((prev) => [...prev, msg])
  socket.on("message", handleMessage)
  return () => socket.off("message", handleMessage)
}, [socket])
```

Two details matter here:

- **`off` needs the same function reference you passed to `on`.** Define the handler inside the effect and close over it. An inline arrow in both places removes nothing.
- **Keep the dependency array minimal.** If the effect depends on state it also updates, it will tear down and re-subscribe on every message. Use the updater form of `setState` — `setMessages(prev => ...)` — so you do not need `messages` in the deps.

Check for a second cause too: if you are appending every message to an array that never gets trimmed, memory and render cost grow even with a correct subscription. Cap the list, or move it out of render state if the UI only shows the last N.

To confirm which one you have, open React DevTools Profiler and watch the render count per message. If one message causes many renders, it is the subscription leak. If it causes one render that keeps getting slower, it is the unbounded array. It is often both.
