---
kind: eval-artifact
run: 1
variant: B
replicate: r2
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Almost certainly the effect is re-subscribing without unsubscribing, so connections and handlers pile up. After ten re-renders you have ten websockets all firing the same handler, ten state updates per message, and it compounds from there.

Two things to check.

**1. Is there a cleanup function?** The effect needs to return one, and it has to actually tear down what the effect set up:

```js
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = handleMessage
  return () => ws.close()   // <- this
}, [url])
```

If you're subscribing to a shared client rather than opening a raw socket, the cleanup has to remove the specific listener you added — `client.off("message", handleMessage)` with the *same function reference* you passed to `on`. An inline arrow function can't be removed later, because the reference is different every render.

**2. What's in the dependency array?** Even with cleanup, an effect that re-runs constantly will tear down and rebuild the socket on every render, which is its own kind of slow. The usual cause is a dependency that's a new object or function each render:

```js
}, [options])   // options = { room: id } defined in the component body — new object every render
```

Fix by depending on primitives (`[roomId]`) or wrapping the value in `useMemo`/`useCallback`.

A third thing worth ruling out if the above is clean: **unbounded state**. If the handler does `setMessages(prev => [...prev, msg])`, the array grows forever and React re-renders a longer list on every single message. Cap it:

```js
setMessages(prev => [...prev.slice(-200), msg])
```

Quickest way to confirm which one you have: open DevTools, Network tab, filter to WS. If the connection count climbs while the page sits there, it's the missing cleanup. If there's one connection but memory keeps growing, it's the unbounded state.

One note — React 18+ in dev mode intentionally mounts, unmounts, and remounts effects once to surface exactly this bug. If something breaks in dev but not production, that's the strict-mode double-invoke telling you the cleanup is incomplete. Don't disable it; it's finding a real leak.
