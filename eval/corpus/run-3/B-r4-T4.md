---
kind: eval-artifact
run: 3
variant: B
replicate: r4
task: T4
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Almost certainly the effect isn't cleaning up its subscription, so you're accumulating listeners. Every time the effect re-runs, it opens a new subscription and the old one stays alive. After an hour you might have hundreds, all firing handlers, all holding references to state that can never be garbage collected. Gradual slowdown that gets worse the longer the page stays open is the classic signature.

The fix is a cleanup function — the thing you return from `useEffect`:

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

React runs that returned function before the effect re-runs and when the component unmounts. Without it, nothing ever tears down.

Two things to check beyond the missing cleanup:

**The dependency array.** If a dependency changes on every render — an inline object, an array literal, a function defined in the component body — the effect re-runs constantly, and you tear down and rebuild the socket dozens of times a second. That's a different bug with similar symptoms. Keep the deps to primitives where you can, or memoize the ones that aren't.

**State that grows without bound.** If message handling does something like `setMessages(prev => [...prev, msg])`, that array only ever gets longer. A busy socket will have you rendering tens of thousands of items eventually. Cap it, or virtualize the list.

Quickest way to confirm which one you have: open DevTools, take a heap snapshot, wait a few minutes, take another, and compare. If listener or socket counts are climbing, it's the missing cleanup.
