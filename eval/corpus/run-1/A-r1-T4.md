---
kind: eval-artifact
run: 1
variant: A
replicate: r1
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Almost certainly a missing cleanup function in that `useEffect`. You're opening a new websocket subscription on every run of the effect and never closing the old one, so subscriptions accumulate for as long as the page is open. Classic "gets slower over time" signature.

**What's going on**

`useEffect` runs on mount, and re-runs whenever anything in its dependency array changes. If the effect subscribes but returns no cleanup, every re-run adds another live subscription on top of the previous ones. After an hour of re-renders you might have hundreds of handlers, each firing on every inbound message, each calling `setState`, each triggering a render — which can trigger the effect again. It compounds.

Symptoms that confirm it: memory climbing steadily in the Performance monitor, a message that should log once logging N times and N growing, and `WebSocket` count climbing in DevTools → Network → WS.

**The fix**

Return a cleanup function. React calls it before every re-run and once on unmount.

```tsx
useEffect(() => {
  const socket = new WebSocket(url)
  const onMessage = (event: MessageEvent) => {
    setMessages((prev) => [...prev, JSON.parse(event.data)])
  }
  socket.addEventListener("message", onMessage)

  return () => {
    socket.removeEventListener("message", onMessage)
    socket.close()
  }
}, [url])
```

**Then check the dependency array**, because that's usually the *real* culprit. If you have something like:

```tsx
useEffect(() => {
  subscribe(topic, handleMessage)
}, [handleMessage, options])   // ← both recreated every render
```

...where `handleMessage` is defined inline in the component and `options` is an object literal, those get a new identity on every render, so the effect tears down and re-subscribes on *every single render*. Even with correct cleanup, that's a connection churn problem — constant reconnect handshakes, dropped messages in the gap.

Fixes for that:

- Wrap the handler in `useCallback` and the options object in `useMemo`, or
- Better: keep the handler out of the deps entirely with a ref, so the effect only depends on things that should genuinely cause a reconnect (the URL, the topic):

```tsx
const handlerRef = useRef(onMessage)
useEffect(() => { handlerRef.current = onMessage })   // no deps, always current

useEffect(() => {
  const socket = new WebSocket(url)
  const listener = (e: MessageEvent) => handlerRef.current(JSON.parse(e.data))
  socket.addEventListener("message", listener)
  return () => {
    socket.removeEventListener("message", listener)
    socket.close()
  }
}, [url])   // reconnects only when the URL actually changes
```

**Two adjacent things worth checking while you're in there**

1. **Unbounded state growth.** If you're appending every websocket message to an array in state, the array grows forever and every render re-processes it. Cap it (`prev.slice(-200)`) or move it out of React state if you don't render all of it.

2. **StrictMode double-invocation.** In dev, React 18+ intentionally mounts, unmounts, and remounts effects to surface exactly this bug. If you're seeing two connections in dev and one in prod, that's StrictMode doing its job — and it means your cleanup is working. If you see two in dev and they *don't* close, that's the bug.

Verify the fix in DevTools → Network → WS: open the page, interact for a few minutes, and confirm the connection count stays flat instead of climbing.
