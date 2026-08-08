---
kind: eval-artifact
run: 4
variant: E
replicate: r3
task: T4
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect almost certainly re-subscribes without unsubscribing, so subscriptions pile up and every message gets handled many times over.

Two things cause it. The effect returns no cleanup function, so React has no way to tear down the old subscription. Or the dependency array holds a value that's rebuilt each render — an object, an array, an inline function — so the effect re-runs constantly. Together they leak a listener per render, and the page gets slower in proportion to how long it's been open.

The shape you want:

```ts
useEffect(() => {
  const socket = new WebSocket(url)
  socket.addEventListener("message", onMessage)
  return () => {
    socket.removeEventListener("message", onMessage)
    socket.close()
  }
}, [url])
```

The cleanup is the whole fix. React runs it before each re-run and again on unmount, so exactly one subscription is live at a time.

Watch the deps too. Keep `url` a plain string rather than an options object. If `onMessage` needs fresh state, hold it in a ref and read `ref.current` inside a stable handler — otherwise the handler identity changes and you tear down the socket on every render.

To confirm before you change anything: log in the subscribe and unsubscribe paths, then leave the page open a minute. If subscribes outnumber unsubscribes, that's your answer. Chrome DevTools' memory profiler will show the retained listeners too.
