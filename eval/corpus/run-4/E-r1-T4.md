---
kind: eval-artifact
run: 4
variant: E
replicate: r1
task: T4
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect is leaking subscriptions. It opens a websocket connection and never closes it, so every re-run stacks another live listener on top of the last one.

Each stacked listener still fires. Ten of them means ten handler calls per message, ten state updates, ten renders. The page gets slower in proportion to how long it's been open. That matches what you're seeing.

Two things cause it, and you may have both.

**No cleanup.** An effect that opens a resource must return a function that closes it. Without the return, React unmounts the component and the socket lives on.

```tsx
useEffect(() => {
  const socket = new WebSocket(url)
  socket.addEventListener("message", onMessage)
  return () => {
    socket.removeEventListener("message", onMessage)
    socket.close()
  }
}, [url])
```

**An unstable dependency.** If the dep array holds an object, array, or inline function, it's a new reference every render, so the effect tears down and re-subscribes constantly. Depend on primitives like `url` and `roomId` instead. If you need a callback inside, keep it in a ref and read `ref.current` in the handler, so the handler stays fresh without re-subscribing.

To confirm before you change anything, log in both the setup and the cleanup with a counter. If setups outnumber cleanups, that's the leak. You can also watch the WS panel in devtools and count connections as you navigate.

One more thing to check: if the handler does `setMessages(prev => [...prev, msg])` with no cap, the array grows forever and re-renders get slower on their own. Cap the list or virtualize it.
