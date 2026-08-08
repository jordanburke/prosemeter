---
kind: eval-artifact
run: 2
variant: G
replicate: r2
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect is opening a new websocket subscription without closing the old one, so they pile up. Every re-run adds a listener. Each new message then fires every handler you ever registered, and the page gets slower the longer it stays open.

Two things cause this, and you may have both.

**No cleanup function.** `useEffect` runs its callback on mount and after any run where the deps changed. If the callback returns nothing, React has no way to undo the subscription. Return a function that tears it down:

```js
useEffect(() => {
  const sub = socket.subscribe(channel, handleMessage)
  return () => sub.unsubscribe()
}, [channel])
```

React calls that returned function before the next run and on unmount. That is the whole fix for the missing-cleanup case.

**Unstable deps.** If the dep array holds an object, array, or function defined in the component body, it is a new value on every render. React compares deps with `Object.is`, so a fresh object never matches, and the effect tears down and re-subscribes on every single render. That is a churn problem rather than a pure leak, but under a stream of messages it burns just as much.

The usual shape is this:

```js
useEffect(() => {
  const sub = socket.subscribe({ channel, userId }, handleMessage)
  return () => sub.unsubscribe()
}, [{ channel, userId }, handleMessage])   // both new every render
```

Fix it by depending on primitives and by keeping the handler stable. Pass `[channel, userId]` instead of the object. Wrap `handleMessage` in `useCallback`, or better, move it inside the effect so it is not a dep at all.

There is a third culprit worth checking: **state updates that grow forever**. If each message does `setMessages(prev => [...prev, msg])`, the array never stops growing. Rendering it gets slower with every message even though the socket is fine. Cap it, or virtualize the list.

To confirm which one you have, open DevTools and take two heap snapshots a few minutes apart, then compare retained objects. Growing listener or closure counts point at the subscription. A growing array points at state. You can also just log inside the effect body and the cleanup; if you see many subscribes and no unsubscribes, you have your answer in ten seconds.

One note on StrictMode in dev: React deliberately mounts, unmounts, and remounts effects once. Seeing a double subscribe locally is expected and is the framework testing your cleanup. Seeing an ever-climbing count is not.
