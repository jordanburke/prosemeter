---
kind: eval-artifact
run: 1
variant: F
replicate: r1
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect is opening a new websocket subscription without closing the old one. Every re-render that re-runs the effect stacks another live listener on top of the last. Messages then fan out to a growing pile of handlers, and the page gets heavier the longer it sits open.

Two mistakes usually cause this.

**You returned no cleanup function.** `useEffect` cleans up only what you tell it to. Return a function that unsubscribes, and React runs it before the next effect and again on unmount.

```js
useEffect(() => {
  const socket = new WebSocket(url)
  socket.addEventListener("message", handleMessage)
  return () => socket.close()
}, [url])
```

**Your dependency array holds a value that changes identity every render.** An inline `handleMessage`, an options object, or a `{ ...config }` literal is a new reference on each render. React compares deps with `Object.is`, sees a change, and tears down and rebuilds the socket constantly. That churn is expensive on its own, and it turns a missing cleanup into a fast leak.

Fix the deps by keeping only primitives in the array, like `url` and `roomId`. Wrap the handler in `useCallback`, or better, store it in a ref and read `ref.current` inside a stable listener. Then the socket outlives the renders.

**Confirm the diagnosis before you change anything.** Open DevTools, go to the Network tab, and filter by WS. One socket that should be one socket is fine. A list that grows as you interact with the page is your bug.

One more thing to check. If your handler does `setMessages(prev => [...prev, msg])` with no cap, memory climbs even with a single clean subscription. Cap the buffer or window the list if the stream is chatty.
