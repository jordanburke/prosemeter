---
kind: eval-artifact
run: 3
variant: B
replicate: r1
task: T4
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Almost certainly your `useEffect` is subscribing but never unsubscribing, so you're accumulating subscriptions. Every time the effect re-runs you add another listener, and the old ones are still there, still firing, still holding onto memory. Ten minutes in you've got dozens of handlers all responding to the same message.

The fix is the cleanup function — the function you return from the effect. React calls it before re-running the effect and again when the component unmounts:

```js
useEffect(() => {
  const socket = new WebSocket(url)
  socket.addEventListener("message", handleMessage)

  return () => {
    socket.removeEventListener("message", handleMessage)
    socket.close()
  }
}, [url])
```

Two things worth checking beyond just adding cleanup:

**Your dependency array.** If it's missing, the effect re-runs on *every* render, and you're opening a new socket each time — that's the fastest possible version of this bug. If it contains something unstable (an object or function defined in the component body, so it's a new reference each render), you get the same result more slowly. Keep dependencies to primitives where you can, or wrap the unstable values in `useMemo`/`useCallback`.

**Where you're putting incoming messages.** A pattern like `setMessages(prev => [...prev, msg])` grows forever. If the page is meant to run for hours, cap it — keep the last N, or page older ones out. Rendering a list that's quietly grown to 50,000 items will feel exactly like a memory leak even when your subscriptions are clean.

To confirm which one it is: open DevTools, go to the Memory tab, take a heap snapshot, leave the page open for a few minutes, take another, and compare. The Network tab's WS section is even quicker for the socket case — if you see connections stacking up there, that's your answer.

React's StrictMode in development deliberately mounts, unmounts, and remounts effects to surface exactly this problem. If you're not running with StrictMode on locally, turning it on will make this class of bug loud instead of silent.
