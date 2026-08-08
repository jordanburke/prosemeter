---
kind: eval-artifact
run: 2
variant: Ep
replicate: r3
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You're almost certainly stacking subscriptions. The effect opens a websocket subscription and never closes it, so every re-run adds another live listener on top of the last one.

Each listener still fires. After ten re-runs, one incoming message triggers ten handlers, ten state updates, and ten renders. That's why it degrades with time open rather than failing outright — the cost grows with how long the page has been alive.

The fix is a cleanup function. Return a function from the effect that tears down whatever the effect set up:

```js
useEffect(() => {
  const sub = socket.subscribe(channel, onMessage)
  return () => sub.unsubscribe()
}, [channel])
```

React runs that cleanup before each re-run and again on unmount, so you never hold more than one subscription.

Then check the dependency array, because it decides how often you pay that setup cost. If `onMessage` is defined inline in the component and sits in the deps, the effect re-runs on every single render — a new function identity each time. Either leave the handler out of the deps and read the current one from a ref, or wrap it in `useCallback`. Only put values in there that should genuinely cause a resubscribe, like `channel`.

Confirm the diagnosis before you go further. Open the Memory tab, take a heap snapshot, wait a few minutes, take another, and compare. Growing listener or closure counts confirm it. If the count is flat and memory still climbs, look instead at an array in state that you append messages to and never trim — an unbounded log grows the same way and needs a cap, not a cleanup.
