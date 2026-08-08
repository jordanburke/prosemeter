---
kind: eval-artifact
run: 5
variant: L
replicate: r1
task: T4
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect is opening a new websocket subscription without closing the old one, so subscriptions pile up as the page runs. Return a cleanup function from the effect.

The pattern looks like this:

```jsx
useEffect(() => {
  socket.on("message", handleMessage)
}, [roomId])
```

Every time `roomId` changes, React runs the effect again and adds another listener. The previous one is still there. After ten room switches, one incoming message fires ten handlers, each calling `setState`, each triggering a render. The page gets slower in proportion to how long it has been open, which matches your symptom exactly.

Fix it by returning a teardown function. React calls it before the next run of the effect and again when the component unmounts:

```jsx
useEffect(() => {
  const handleMessage = (msg) => setMessages((prev) => [...prev, msg])
  socket.on("message", handleMessage)
  return () => socket.off("message", handleMessage)
}, [roomId])
```

Two details matter here. The handler must be the same function reference in both calls, or `off` removes nothing — so define it inside the effect. And if you open the connection inside the effect rather than subscribing to a shared one, close it in the cleanup too.

Check three other suspects while you are in there.

**A stale dependency array.** If the array omits something the effect reads, the subscription holds an old closure and an old state value. Turn on the `react-hooks/exhaustive-deps` lint rule; it finds these.

**An unstable dependency.** If a dependency is an object or function created fresh on every render, the effect tears down and re-subscribes on every render. That is churn rather than a leak, but it burns the same CPU. Wrap the value in `useMemo` or `useCallback`, or move it inside the effect.

**Setting state after unmount.** If a message arrives after the component is gone, `setState` on a dead component is wasted work and, with async fetches, a real leak. The cleanup above prevents it for subscriptions. For fetches, use an `AbortController` and abort in the cleanup.

To confirm the diagnosis before you change anything, log inside the effect and inside the cleanup. If you see subscribes with no matching unsubscribes, that is your leak. Chrome DevTools also shows it: take a heap snapshot when the page opens, use it for a few minutes, take another, and compare retained listener counts.

One caveat on Strict Mode in development. React 18 runs effects twice on mount to surface exactly this bug. If your effect is correct, the double-run is invisible. If you see doubled subscriptions in dev but not production, that is React telling you the cleanup is missing — fix the cleanup rather than disabling Strict Mode.
