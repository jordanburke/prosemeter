---
kind: eval-artifact
run: 2
variant: Ep
replicate: r4
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect almost certainly opens a websocket without closing it, so every re-run stacks another live connection on the page.

Here is the mechanism. React runs the effect, you subscribe. A dependency changes, so React runs the effect again — but the old subscription is still there, still holding its handler, still pushing state updates. Now two sockets feed the same component. Then three. Each one keeps its closure alive, so memory climbs and every message does N times the work. That is why it degrades with time rather than failing outright.

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

React runs that cleanup before each re-run and once on unmount. One socket at a time, guaranteed.

Two things to check while you are in there:

**Your dependency array.** If it holds an object or a function defined in the component body, it gets a new identity every render, so the effect tears down and reconnects on *every* render. Depend on primitives like `url`, or wrap the handler in `useCallback`.

**Your message handler.** If it does `setMessages(prev => [...prev, msg])` with no bound, the array grows forever and re-renders get slower as it does. That produces the same symptom with the socket handled correctly. Cap it, or move the history out of render state.

To confirm which one you have: open DevTools, Network tab, filter to WS, and watch the connection count as you use the page. More than one means it is the cleanup. Exactly one means it is the unbounded state.
