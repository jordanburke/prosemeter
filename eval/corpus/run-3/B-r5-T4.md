---
kind: eval-artifact
run: 3
variant: B
replicate: r5
task: T4
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You're almost certainly opening a new websocket subscription every time the effect runs, and never closing the old ones. They stack up. Ten minutes in you have dozens of live subscriptions, all firing handlers, all triggering renders — hence the gradual slowdown.

Two things cause this, and you might have both:

**1. No cleanup function.** `useEffect` lets you return a function that React calls before the next run and on unmount. If you don't return one, nothing ever tears down the subscription:

```js
useEffect(() => {
  const socket = connect(url)
  socket.on("message", handleMessage)
  return () => {
    socket.off("message", handleMessage)
    socket.close()
  }
}, [url])
```

**2. An unstable dependency.** Even with cleanup, if the dependency array contains something that's a new value on every render — an inline object, an inline arrow function, an array literal — the effect tears down and reconnects on every single render. That's not a leak exactly, but it's a reconnect storm, and it will also make things crawl. Same fix as always: keep the deps to primitives, or memoize the object.

**How to confirm which it is:** open the Network tab, filter to WS, and watch while the page sits there. If the list of connections grows, it's missing cleanup. If connections rapidly open and close, it's an unstable dependency. A `console.log` at the top of the effect and in the cleanup will tell you the same story — you want them to alternate one-for-one.

One more thing worth checking once the subscription is fixed: if the handler is doing `setMessages(prev => [...prev, msg])` on an unbounded array, that array grows forever and every render gets more expensive. If you're rendering a live feed, cap it — keep the last N messages and drop the rest.

Also note that in React 18+ StrictMode, effects deliberately run twice in development to surface exactly this bug. If it looks doubled in dev but fine in prod, that's the mechanism doing its job, and the fix is still a proper cleanup function.
