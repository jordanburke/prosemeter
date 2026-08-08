---
kind: eval-artifact
run: 5
variant: A
replicate: r2
task: T4
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You are almost certainly leaking websocket subscriptions. The effect subscribes, something makes it run again, and nothing ever unsubscribes — so after an hour you have hundreds of live handlers, all firing on every message.

## Why the page degrades over time

A `useEffect` that opens a subscription must return a cleanup function. Without one, React has no way to tear the subscription down when the effect re-runs or the component unmounts.

```jsx
// leaks
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = (e) => setMessages((m) => [...m, JSON.parse(e.data)])
}, [url])
```

Every re-run adds a socket. The old ones stay open, stay subscribed, and keep calling `setMessages` — on a component that may not even be mounted. The symptoms match what you describe exactly:

- **Slows down gradually.** Each message now triggers N handlers and N re-renders, and N grows.
- **Memory climbs.** Each closure pins its render's props and state, so nothing gets collected.
- **Duplicate messages appear**, because several handlers all append the same payload.
- **Console warnings about setting state on an unmounted component**, if any of the leaked subscribers outlive the mount.

## The three likely causes

**1. No cleanup at all.** The effect never returns a function. Most common by far.

**2. Cleanup exists, but the dependency array churns.** If a dependency is a new object or function on every render, the effect tears down and re-subscribes on every render. That does not leak, but it is its own performance problem — a socket reconnect per render is brutal, and with React Query or similar it can hammer your backend.

```jsx
// re-subscribes constantly: `options` is a fresh object each render
useEffect(() => { ... }, [url, options])
```

**3. Handlers accumulate on a shared socket.** If you use a singleton client and call `socket.on("message", handler)` without a matching `off`, the socket survives but the listener list grows without bound. Same symptom, different mechanism — and this one survives unmount, so it is the version that persists across route changes.

## The fix

Return a cleanup function that undoes exactly what the effect did:

```jsx
useEffect(() => {
  const ws = new WebSocket(url)

  const onMessage = (e) => {
    setMessages((m) => [...m, JSON.parse(e.data)])
  }

  ws.addEventListener("message", onMessage)

  return () => {
    ws.removeEventListener("message", onMessage)
    ws.close()
  }
}, [url])
```

For a shared client:

```jsx
useEffect(() => {
  const handler = (msg) => setMessages((m) => [...m, msg])
  socket.on("message", handler)
  return () => socket.off("message", handler)
}, [socket])
```

Note `socket.off("message", handler)` with the same function reference. `socket.off("message")` with no handler removes *everyone's* listener, which trades a leak for a much more confusing bug.

## Stabilizing the dependencies

Once cleanup is in place, make sure the effect is not thrashing.

- Keep the dependency array to primitives — the URL string, an id — not objects or arrays.
- If you need a callback inside the effect that changes often, do not put it in the deps. Hold it in a ref and read `ref.current` inside the handler, so the handler stays stable while the behavior stays fresh.

```jsx
const onMessageRef = useRef(onMessage)
useEffect(() => { onMessageRef.current = onMessage })

useEffect(() => {
  const ws = new WebSocket(url)
  ws.addEventListener("message", (e) => onMessageRef.current(e))
  return () => ws.close()
}, [url])   // only url
```

## Two more things worth checking

**Unbounded message state.** `setMessages((m) => [...m, msg])` grows forever. On a busy socket, that array alone will slow the page down even with the leak fixed, because every render copies and re-renders the whole list. Cap it (`m.slice(-500)`), or virtualize the list, or both.

**StrictMode double-invocation.** In development, React 18+ mounts, unmounts, and remounts effects deliberately, to surface exactly this bug. If you see two sockets in dev and one in production, that is StrictMode telling you the cleanup is missing or incomplete — not a false alarm to work around.

## How to confirm it

Open DevTools, Network tab, filter to WS, and leave the page running. One socket is correct. A list that grows is your answer. For the shared-client case, log `socket.listenerCount("message")` on an interval instead — a number that climbs is the same finding.
