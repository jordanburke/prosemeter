---
kind: eval-artifact
run: 3
variant: A
replicate: r2
task: T4
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Almost certainly your effect is subscribing repeatedly without ever unsubscribing. Every time it re-runs you add another websocket listener, the old ones stay attached, and now N handlers fire per message. The page gets slower in proportion to how long it's been open, which matches exactly what you're seeing.

Two things to check.

**1. Is there a cleanup function?** The effect has to return one, and it has to actually tear down what it set up:

```tsx
useEffect(() => {
  const socket = new WebSocket(url)
  const onMessage = (e: MessageEvent) => setData(JSON.parse(e.data))
  socket.addEventListener("message", onMessage)

  return () => {
    socket.removeEventListener("message", onMessage)
    socket.close()
  }
}, [url])
```

Without the return, nothing ever gets removed. Note the handler is a named reference — `removeEventListener` with a fresh inline arrow removes nothing, which is a quiet way to have "cleanup" that doesn't clean anything up.

**2. What's in the dependency array?** If it's missing entirely, the effect re-runs on *every single render* — that's the fast-degrading version. If the array contains something unstable — an object literal, an array, a callback defined in the component body — it's a new reference each render, so the effect tears down and re-subscribes constantly. Same symptom, and it also thrashes the connection.

```tsx
}, [{ room: roomId }])  // new object every render, effect runs every render
}, [roomId])            // primitive, stable
```

If you need a non-primitive in there, memoize it with `useMemo`/`useCallback` so the identity holds.

To confirm the diagnosis in about a minute: log in the effect body and in the cleanup. If you see setups piling up with no matching teardowns, that's it. Chrome DevTools also has a Network → WS panel — multiple open sockets for one page is the same story. The Memory tab's heap snapshot comparison over a few minutes will show the retained handlers growing if you want the harder proof.

One caveat worth knowing: in React 18+ StrictMode, dev-mode mounts every effect twice on purpose, specifically to surface missing cleanup. If the double-subscribe only reproduces in dev, that's the mechanism — but it's still telling you the cleanup is wrong, so fix it rather than dismissing it.

If the same socket is needed by several components, hoist it out of the component into a shared module or context with a subscriber count, so you have one connection with N listeners rather than N connections. That also gives you one place to handle reconnects.
