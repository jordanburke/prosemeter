---
kind: eval-artifact
run: 2
variant: G
replicate: r3
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You are leaking websocket subscriptions. Your effect subscribes on every run and never unsubscribes, so the handlers pile up and each message now fires several times.

**The bug looks like this:**

```jsx
useEffect(() => {
  socket.on("message", handleMessage)
}, [roomId])
```

Every time `roomId` changes, the effect runs again and adds another listener. The old one stays. After ten room switches you have ten live listeners, each doing a state update on every message. The page gets slower and slower, exactly the way you describe.

**The fix is the cleanup function.** Return it from the effect, and React runs it before the next run and again on unmount.

```jsx
useEffect(() => {
  socket.on("message", handleMessage)
  return () => socket.off("message", handleMessage)
}, [roomId])
```

If you open the socket inside the effect rather than sharing one, close it in the cleanup too.

**Two things that make this worse, and you should check both.**

First, an unstable handler. If `handleMessage` is defined inside the component body and listed in the deps, it is a new function on every render, so the effect tears down and rebuilds constantly. Either define it inside the effect, or wrap it in `useCallback`.

Second, missing deps. If the effect has no dependency array at all, it re-subscribes on **every** render, and a state update from a message triggers a render, which re-subscribes, which... that one degrades fast.

**How to confirm it.** In dev, `socket.listenerCount("message")` climbs instead of staying flat. In Chrome DevTools, take two heap snapshots a few minutes apart and compare — you will see the listener array or the closures it holds growing. React 18 StrictMode also helps here, because it mounts effects twice in dev on purpose, so a missing cleanup shows up as doubled messages right away.

**Worth knowing.** Growing listeners is the common cause, but not the only one. Unbounded arrays cause the same symptom — if you push every incoming message into state and never trim, the render cost climbs with the list. Cap it, or move to a virtualized list.
