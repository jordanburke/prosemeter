---
kind: eval-artifact
run: 1
variant: D
replicate: r1
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
reviewerFinding:
  severity: minor
  foundBy: "sonnet"
  error: "Offers useMemo alongside useRef to stabilize a WebSocket. useMemo has no cleanup hook and may recompute without closing the old socket."
---
Gets slower the longer it's open, with a websocket subscription in a `useEffect` — that's almost certainly a subscription leak. Your effect is re-running and adding a new listener each time without removing the old one, so after a while you've got dozens of handlers all reacting to every message.

The mechanism: `useEffect` runs its body after render, and it runs again whenever anything in the dependency array changes. It only tears down what you tell it to tear down — via the cleanup function you return. If you don't return one, or if the cleanup doesn't actually remove the same listener you added, subscriptions accumulate. Handler count grows linearly with re-renders, and the work per incoming message grows with it. Hence "fine at first, unusable after ten minutes."

Two flavors, both common:

```js
// Flavor 1: no cleanup at all
useEffect(() => {
  socket.on("message", handleMessage)
}, [])   // even with [], StrictMode double-mounts this in dev — and any
         // remount in prod leaks a handler
```

```js
// Flavor 2: cleanup exists, but deps churn so it thrashes
useEffect(() => {
  const handler = (m) => setMessages([...messages, m])
  socket.on("message", handler)
  return () => socket.off("message", handler)
}, [messages])   // messages changes on every message → unsubscribe/resubscribe
                 // on every message. Not a leak exactly, but churny, and it's
                 // one typo away from being one.
```

Flavor 2 is worth understanding because it's what people write when they try to fix flavor 1. The reason `messages` is in the deps is that the handler closes over it — with an empty array the handler would forever see the *first* render's `messages` and you'd only ever have one item. That's the stale closure problem, and reaching for the dep array is the wrong lever for it.

**The fix** is the functional state update, which breaks the dependency on the current value entirely:

```js
useEffect(() => {
  const handler = (m) => setMessages((prev) => [...prev, m])
  socket.on("message", handler)
  return () => socket.off("message", handler)
}, [socket])
```

Now the handler doesn't reference `messages` at all — the updater gets the latest value from React — so the effect only re-runs if `socket` itself changes. One subscribe, one unsubscribe, no leak, no stale data.

Two follow-ups:

- **Make sure `socket` is actually stable.** If you're doing `const socket = new WebSocket(url)` in the component body, you're creating a new socket every render and the dep array will fire every time. Hoist it into a `useRef`, a `useMemo`, a context, or module scope.
- **If the handler genuinely needs fresh props/callbacks** (an `onMessage` prop, say), keep it in a ref: `useEffect(() => { cbRef.current = onMessage })` and have the socket handler call `cbRef.current(m)`. That gives you fresh values without putting the callback in the subscription effect's deps.

**To confirm before you change anything:** log inside the handler and see if one incoming message produces N logs, with N climbing over time. Or take two heap snapshots in DevTools a few minutes apart and look at retained listener/closure counts. Worth doing — "page gets slow over time" also fits an unbounded array in state, so verify it's the subscription and not just `messages` growing to 50,000 items with no windowing.
