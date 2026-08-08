---
kind: eval-artifact
run: 1
variant: E
replicate: r2
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You are almost certainly leaking subscriptions. The effect opens a websocket subscription and never closes it, so every re-run stacks another live listener on top of the old ones.

Each listener still holds a closure over the render's props and state, so none of it can be garbage collected. Ten re-runs later, one incoming message triggers ten handlers, and each one fires a state update. Renders multiply, memory climbs, and the page crawls the longer it stays open.

Two things cause the re-runs:

- **A missing or unstable dependency array.** No array means the effect runs after every render. An array holding an object, array, or inline function means a fresh identity every render, which is the same thing.
- **No cleanup function.** Even with correct deps, the effect must unsubscribe when deps change or the component unmounts. React Strict Mode in development mounts twice on purpose to surface exactly this.

The fix is to return a cleanup function:

```tsx
useEffect(() => {
  const socket = new WebSocket(url)
  socket.addEventListener("message", handleMessage)

  return () => {
    socket.removeEventListener("message", handleMessage)
    socket.close()
  }
}, [url])
```

Three rules to keep it clean:

1. **Return a cleanup from every effect that subscribes to anything** — sockets, timers, event listeners, observers.
2. **Keep dependencies primitive.** Depend on `url` and `roomId`, not on a config object you rebuild each render. Wrap handlers in `useCallback` or move them outside the component.
3. **Read fresh state through the updater form.** Use `setMessages(prev => [...prev, msg])` so the handler does not need `messages` in its deps.

To confirm the diagnosis, open DevTools, watch the Network tab's WS panel, and count the open connections after the page sits for a few minutes. One connection is right. A growing list is your bug.

If several components need the same stream, lift the socket into a provider or a store and let components subscribe to that. One connection for the app beats one per component.
