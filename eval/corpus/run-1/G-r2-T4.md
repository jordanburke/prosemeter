---
kind: eval-artifact
run: 1
variant: G
replicate: r2
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect subscribes but never unsubscribes, so subscriptions pile up. Every re-run adds a listener and the old one keeps running.

The bug looks like this:

```jsx
useEffect(() => {
  socket.on("message", handleMessage)
}, [handleMessage])
```

React runs the effect, adds a listener, and moves on. Something changes, React runs the effect again, and now two listeners handle every message. Ten minutes in you have hundreds. Each one holds a closure over the props and state from its render, so those never get collected either. That's why it degrades over time rather than being slow from the start: work per message grows, and memory grows with it.

Fix it with a cleanup function. Return a function from the effect and React calls it before the next run and on unmount.

```jsx
useEffect(() => {
  socket.on("message", handleMessage)
  return () => socket.off("message", handleMessage)
}, [handleMessage])
```

If the effect opens the socket rather than using a shared one, close it in cleanup:

```jsx
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = handleMessage
  return () => ws.close()
}, [url])
```

Now the second half, which is usually the real culprit. Look at why the effect re-runs at all. If `handleMessage` is defined in the component body, it's a new function on every render, so the dependency changes every render, so the effect tears down and re-subscribes constantly. That thrashes the connection even with correct cleanup.

Two ways out:

- Wrap the handler in `useCallback` with a stable dependency list.
- Better, keep the handler in a ref and depend only on the connection itself:

  ```jsx
  const handlerRef = useRef(handleMessage)
  useEffect(() => {
    handlerRef.current = handleMessage
  })

  useEffect(() => {
    const ws = new WebSocket(url)
    ws.onmessage = (e) => handlerRef.current(e)
    return () => ws.close()
  }, [url])
  ```

  The socket opens once per URL. The handler stays current. No churn.

Two things to confirm you actually fixed it:

1. **Watch it happen.** Open DevTools, log inside the subscribe and the cleanup, and check the counts match. If subscribes outrun cleanups, you're still leaking.
2. **Expect double effects in dev.** React 18+ Strict Mode mounts, unmounts, and remounts every component in development. That's on purpose — it surfaces exactly this bug. If your cleanup is right, the double run is harmless. If you see it as noise to work around, the cleanup is wrong.

Also check whether anything accumulates in state. A `setMessages(prev => [...prev, msg])` with no cap will slow the page down on its own, cleanup or not. Trim to the last N.
