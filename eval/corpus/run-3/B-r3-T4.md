---
kind: eval-artifact
run: 3
variant: B
replicate: r3
task: T4
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Almost certainly you're subscribing more than once and never unsubscribing. Every time the effect re-runs you open another websocket subscription, the old ones stay alive, and now three, then ten, then fifty handlers all fire on every message. The page gets steadily heavier the longer it sits there.

**Two things to check.**

**1. Are you cleaning up?** A `useEffect` that subscribes must return a function that unsubscribes:

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

That returned function is the cleanup. React runs it before the effect runs again, and when the component unmounts. Without it, nothing ever tears the old subscription down.

**2. Is the effect re-running more than it should?** Look at the dependency array. Common causes:

- **No array at all** — the effect runs after *every* render. Guaranteed leak.
- **An object, array, or function in the deps** that's defined inline in the component body. It's a new reference on every render, so React sees the dependency as "changed" every time, and the effect re-runs constantly. Wrap it in `useMemo`/`useCallback`, or move it outside the component, or depend on the primitive values inside it instead of the object.
- **A handler defined in the component** that you pass to `socket.on`. Same problem — new function identity each render.

**How to confirm it quickly.** Add a `console.log` in the effect and in the cleanup. Open the page, interact with it a bit, and count. If you see five "subscribed" and zero "unsubscribed," that's your answer. You can also watch memory in DevTools — a heap snapshot after a few minutes will show the accumulated handlers.

**One more thing.** Even with correct cleanup, if the effect is re-running frequently you're churning websocket connections, which is its own performance problem. The goal is a stable dependency array so the effect runs once on mount and once on unmount. If you find yourself fighting this a lot, pulling the websocket into a context or a small singleton outside React — with the component just subscribing to it — is usually cleaner than trying to make the effect deps behave.
