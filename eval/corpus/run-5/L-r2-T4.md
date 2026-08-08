---
kind: eval-artifact
run: 5
variant: L
replicate: r2
task: T4
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect subscribes on every run and never unsubscribes, so subscriptions pile up. Fix it by returning a cleanup function from the effect and giving the effect a correct dependency array.

Here is the shape of the bug.

```jsx
useEffect(() => {
  const socket = new WebSocket(url)
  socket.onmessage = (e) => setMessages((m) => [...m, JSON.parse(e.data)])
})
```

Two things are wrong. The effect returns nothing, so React has no way to tear the socket down. And it has no dependency array, so it runs after every render. Each render opens a socket, every open socket delivers every message, each message sets state, and that render opens another socket. The page slows as the sockets multiply.

Fix it like this.

```jsx
useEffect(() => {
  const socket = new WebSocket(url)
  socket.onmessage = (e) => setMessages((m) => [...m, JSON.parse(e.data)])
  return () => socket.close()
}, [url])
```

The returned function is the cleanup. React runs it before the next effect run and when the component unmounts. Now one socket lives at a time.

Watch for three related traps.

- **An object or function in the dependency array.** `[options]` where `options` is built inline gets a new identity each render, so the effect reruns every render anyway. Depend on primitives — `[url, roomId]` — or wrap the object in `useMemo`.
- **The unbounded message array.** Even with one socket, `setMessages((m) => [...m, next])` grows without limit. A long-lived page will slow down from render cost alone. Cap it: `[...m, next].slice(-500)`.
- **Handlers registered outside the effect.** If you attach `onmessage` somewhere the cleanup cannot reach, closing the socket still leaks the closure. Keep create and destroy in the same effect.

Confirm the fix in DevTools. The Network tab's WS filter should show one connection, not a growing list. React StrictMode in development mounts each effect twice on purpose — that double-run is the check that your cleanup works, so do not silence it.

One design note. A socket shared by several components does not belong in a component effect at all. Open it once in a module or a context provider, and let components subscribe to it and unsubscribe in their own cleanups.
