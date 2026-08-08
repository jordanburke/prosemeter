---
kind: eval-artifact
run: 3
variant: A
replicate: r1
task: T4
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Almost certainly your effect is subscribing repeatedly without unsubscribing, so you're accumulating live websocket handlers. Every re-render that re-runs the effect adds another listener, none of the old ones ever go away, and each incoming message now fans out to N handlers instead of one. Gets worse the longer the page is open, which matches exactly what you're seeing.

Two things cause it, and you might have both.

**1. No cleanup function.**

```jsx
useEffect(() => {
  socket.on("message", handleMessage)
}, [roomId])
```

When `roomId` changes, React runs the effect again — but there's nothing tearing down the previous subscription. Handler count climbs by one per change. Fix is to return a cleanup:

```jsx
useEffect(() => {
  socket.on("message", handleMessage)
  return () => {
    socket.off("message", handleMessage)
  }
}, [roomId])
```

React calls that cleanup before each re-run and once on unmount. Note that `socket.off` usually needs the *same function reference* you passed to `on` — if `handleMessage` is redefined each render and you're not careful, `off` silently removes nothing and you're back where you started.

**2. Unstable dependencies.**

```jsx
useEffect(() => {
  socket.on("message", (m) => setMessages([...messages, m]))
  return () => socket.off("message")
}, [messages, onUpdate, config])
```

Here you *have* cleanup, but the effect churns constantly. `messages` changes on every message. `onUpdate` and `config` are new objects/functions every render if the parent creates them inline. So you tear down and rebuild the subscription many times a second — which is a different kind of slow (constant work, GC pressure, possibly reconnect storms) even if you're not leaking handlers.

The fix is to stop depending on things that change:

```jsx
useEffect(() => {
  const handle = (m) => setMessages((prev) => [...prev, m])
  socket.on("message", handle)
  return () => socket.off("message", handle)
}, [socket])
```

The functional `setMessages(prev => ...)` form reads the current state without closing over it, so `messages` leaves the dependency array entirely. For a callback prop that genuinely changes, stash it in a ref and read `ref.current` inside the handler — the effect stays subscribed while the behavior stays current.

**How to confirm it's this.** Open DevTools → Memory, take a heap snapshot, use the app for a minute, take another, and compare. Growing retained closures or detached listeners is your answer. If your socket library exposes a listener count (`socket.listenerCount("message")` on an EventEmitter-style API), log it on an interval — watching it climb from 1 to 40 is unambiguous, and takes ten seconds.

**Two things that look like this but aren't.**

If you're in React 18+ StrictMode in dev, effects run mount → unmount → mount deliberately. You'll see two subscriptions at startup. That's the check working, not the bug — it's showing you that your cleanup is missing. It doesn't happen in production, so it can't be the whole story for a page that degrades over minutes, but it will make your listener counts look off by one while you're debugging.

The other possibility, if cleanup is correct and deps are stable: you're just accumulating **state**. A `messages` array that grows unboundedly will slow the page down through rendering cost alone, no leak required. If that's it, cap the array (`prev.slice(-500)`) or virtualize the list. Worth ruling out before you go hunting for listeners.
