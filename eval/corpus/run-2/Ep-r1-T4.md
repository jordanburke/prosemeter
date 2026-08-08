---
kind: eval-artifact
run: 2
variant: Ep
replicate: r1
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect subscribes but never unsubscribes, so you stack a new websocket listener every time it re-runs. That is a leak, and it compounds — after an hour you have dozens of live handlers, each one firing on every message and each one calling `setState`.

The effect re-runs whenever a dependency changes identity. A handler defined in the component body is a new function on every render, so listing it as a dependency re-runs the effect on every render. Without a cleanup, the old subscription stays alive.

The fix is the return value of the effect:

```js
useEffect(() => {
  const socket = new WebSocket(url)
  const onMessage = (e) => setMessages((prev) => [...prev, JSON.parse(e.data)])
  socket.addEventListener("message", onMessage)

  return () => {
    socket.removeEventListener("message", onMessage)
    socket.close()
  }
}, [url])
```

React calls that cleanup before each re-run and again on unmount. Every subscribe now has exactly one matching unsubscribe.

Two things to check while you are in there:

- **Keep the dependency array minimal.** `[url]` is right. Adding a handler or an options object defined in the render body puts you back to reconnecting on every render, which is its own performance problem even with cleanup working.
- **Look at what you do with the messages.** If you append to an array that never gets trimmed, the page slows down as that array grows regardless of the subscription bug. Cap it, or move it to a ref if you do not render every entry.

To confirm it is the leak and not something else, open DevTools, watch the Network tab's WS section, and see whether the connection count climbs as the page sits. If you see one connection but the page still degrades, it is the unbounded state, not the subscription.
