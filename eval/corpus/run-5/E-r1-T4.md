---
kind: eval-artifact
run: 5
variant: E
replicate: r1
task: T4
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect almost certainly opens a websocket subscription and never closes it. Each run adds another live subscription, so handlers pile up, every message runs all of them, and memory and CPU climb the longer the page stays open. Return a cleanup function from the effect and the leak stops.

## The shape of the bug

The broken version looks like this:

```jsx
useEffect(() => {
  socket.on("message", handleMessage)
}, [roomId])
```

React runs the effect on mount and again whenever `roomId` changes. Nothing ever removes the old handler. After five room switches, `socket.on("message")` has five listeners, and each incoming message triggers five state updates and five renders.

The leak also holds every closure alive. Each stale handler still references the props and state from its render, so the garbage collector cannot free them. Memory grows, renders slow, and the page gets worse the longer it lives.

Two extra clues that confirm it:

- The slowdown scales with time or with how often you switch views, not with how much data you loaded.
- In React 18 dev mode with StrictMode, it is bad immediately — StrictMode mounts, unmounts, and remounts every effect on purpose, precisely to expose missing cleanup.

## The fix

Return the teardown:

```jsx
useEffect(() => {
  const handleMessage = (msg) => setMessages((prev) => [...prev, msg])
  socket.on("message", handleMessage)
  return () => {
    socket.off("message", handleMessage)
  }
}, [roomId])
```

The cleanup runs before the next effect and again on unmount. One subscription lives at a time.

Note the named `handleMessage`. `socket.off` removes by reference, so an inline arrow in `on` and another in `off` are two different functions and the removal silently does nothing.

If the effect owns the connection rather than a handler on a shared one, close the connection instead:

```jsx
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = (e) => setMessages((prev) => [...prev, JSON.parse(e.data)])
  return () => ws.close()
}, [url])
```

## The near misses

Three variants leak for related reasons. Check for these too.

**Cleanup that races.** If you open the socket after an `await`, the effect may have been cleaned up before the socket exists. Guard with a flag:

```jsx
useEffect(() => {
  let cancelled = false
  let ws
  connect(url).then((s) => {
    if (cancelled) return s.close()
    ws = s
  })
  return () => {
    cancelled = true
    ws?.close()
  }
}, [url])
```

**A dependency that changes every render.** Passing an object or an inline callback in the dependency array makes the effect tear down and rebuild on every render. That is not a leak, but it reconnects the socket constantly, which is its own kind of slow. Memoize the value or move it inside the effect.

**Unbounded state.** `setMessages(prev => [...prev, msg])` grows forever. Even with perfect cleanup, a long-lived page rendering 50,000 messages will crawl. Cap the list, or virtualize the render.

## How to confirm it

Open Chrome DevTools, take a heap snapshot, switch rooms ten times, take another, and compare. Retained closures or detached listeners climbing in step with your switches is the proof. The Performance panel's memory graph showing a staircase that never drops after garbage collection says the same thing faster.

## The rule

Any effect that subscribes, opens, times, or observes must return the matching unsubscribe, close, clear, or disconnect. React gives you the cleanup slot for exactly this; leaving it empty is the default failure mode of `useEffect`.
