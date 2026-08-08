---
kind: eval-artifact
run: 4
variant: Et
replicate: r3
task: T4
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect subscribes but never unsubscribes. Every time it re-runs you add another listener, and the old ones keep firing. That is why it degrades with time open rather than all at once.

**The shape of the bug:**

```tsx
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = (e) => setMessages((m) => [...m, JSON.parse(e.data)])
}, [url])
```

No return value, so React has no cleanup to call. On unmount, or on any dependency change, the socket stays open and the handler stays wired to a stale closure. Ten re-runs later, one incoming message triggers ten state updates and ten renders.

**Fix it by returning a cleanup function:**

```tsx
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = (e) => setMessages((m) => [...m, JSON.parse(e.data)])
  return () => ws.close()
}, [url])
```

React runs that before every re-run and once on unmount.

**Check the dependency array too.** If a dep is a value you recreate each render — an options object, an inline callback, an array literal — the effect tears down and rebuilds the socket on every single render. That is a different failure with the same symptom, and cleanup alone will not stop the churn. Memoize the dep, or move it out of the array if it does not need to trigger a reconnect.

**Two things that also cause "slower the longer it is open":**

- **Unbounded state.** `[...m, msg]` grows forever. After an hour of a chatty socket you are rendering thousands of nodes. Cap it, virtualize the list, or hold the buffer in a ref and render a window.
- **Every message re-rendering the whole tree.** If the socket state lives high up, one message repaints the page. Push the subscription down to the component that needs it, or put it behind a store with selector subscriptions.

**How to confirm which one you have.** Open DevTools, Network, WS — count the open sockets. More than one means the leak. One socket with a growing render time means the state growth.
