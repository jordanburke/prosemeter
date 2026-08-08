---
kind: eval-artifact
run: 3
variant: E
replicate: r2
task: T4
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect is probably subscribing again on every render without cleaning up the old subscription. Each render leaves a live listener behind, so handlers pile up, and every message runs all of them.

Two bugs usually cause this, and you may have both.

**No cleanup function.** `useEffect` runs your subscribe call, but nothing unsubscribes. Return a cleanup function and React calls it before the next run and on unmount:

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

**A dependency that changes identity every render.** If your dep array holds an inline object, an inline function, or a value rebuilt each render, React sees a new dependency and tears down and re-subscribes constantly. Even with correct cleanup, that churns connections. Worse, an empty-looking array is not the problem — the problem is a `{}` or `() => {}` sitting in it.

How to confirm which one you have. Open the Network tab, filter to WS, and watch the connection count while the page sits idle. Growing count means re-subscribing. One connection with growing memory means listeners accumulating on it. You can also log in the effect body and in the cleanup — if subscribes outnumber cleanups, you found it.

Two more things that cause the same symptom:

**Unbounded state.** If each message appends to an array in state and nothing trims it, the page slows as the array grows and React re-renders a longer and longer list. Cap it: `setMessages(prev => [...prev.slice(-500), msg])`.

**Stale closures patched with more subscriptions.** If the handler needed fresh state and someone fixed that by adding state to the dep array, the socket now reconnects on every state change. Use a ref for values the handler reads but should not trigger re-subscription:

```tsx
const stateRef = useRef(state)
stateRef.current = state
```

One note on Strict Mode. In development, React 18+ mounts, unmounts, and remounts effects on purpose to surface missing cleanup. If you see exactly two connections in dev and one in prod, that is Strict Mode doing its job, not a leak.
