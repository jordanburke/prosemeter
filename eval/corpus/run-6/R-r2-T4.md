---
kind: eval-artifact
run: 6
variant: R
replicate: r2
task: T4
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

You are leaking websocket subscriptions. The effect subscribes, a dependency change makes it run again, and nothing unsubscribes. After an hour you have hundreds of live handlers, all firing on every message.

## Why the page degrades over time

A `useEffect` that opens a subscription must return a cleanup function. Without one, React cannot tear the subscription down when the effect re-runs or the component unmounts.

```jsx
// leaks
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = (e) => setMessages((m) => [...m, JSON.parse(e.data)])
}, [url])
```

Every re-run adds a socket. The old ones stay open, stay subscribed, and keep calling `setMessages` on a component that may already be unmounted. The symptoms match what you describe:

- **Slows down over time.** Each message triggers N handlers and N re-renders, and N grows.
- **Memory climbs.** Each closure pins its render's props and state, so nothing gets collected.
- **Duplicate messages show up**, because four or five handlers append the same payload.
- **Console warnings about setting state on an unmounted component**, when leaked subscribers outlive the mount.

## The three causes

**1. No cleanup at all.** The effect never returns a function. This is the common one.

**2. Cleanup exists, but the dependency array churns.** A dependency that is a new object or function on every render makes the effect tear down and re-subscribe on every render. That does not leak. It is its own performance problem — a socket reconnect per render is brutal, and with React Query it hammers your backend.

```jsx
// re-subscribes constantly: `options` is a fresh object each render
useEffect(() => { ... }, [url, options])
```

**3. Handlers accumulate on a shared socket.** Use a singleton client, call `socket.on("message", handler)`, and skip the matching `off`. The socket survives and the listener list grows without bound. Same symptom, different mechanism. This one survives unmount, so it persists across route changes.

## The fix

Return a cleanup function that undoes what the effect did:

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

Note `socket.off("message", handler)` with the same function reference. `socket.off("message")` with no handler removes *everyone's* listener. That trades a leak for a far more confusing bug.

## Stabilizing the dependencies

Once cleanup is in place, check that the effect is not thrashing.

- Keep the dependency array to primitives — the URL string, an id. No objects, no arrays.
- Need a callback inside the effect that changes on every keystroke? Keep it out of the deps. Hold it in a ref and read `ref.current` inside the handler. The handler stays stable while the behavior stays fresh.

```jsx
const onMessageRef = useRef(onMessage)
useEffect(() => { onMessageRef.current = onMessage })

useEffect(() => {
  const ws = new WebSocket(url)
  ws.addEventListener("message", (e) => onMessageRef.current(e))
  return () => ws.close()
}, [url])   // only url
```

## Two more items to check

**Unbounded message state.** `setMessages((m) => [...m, msg])` grows forever. On a busy socket, that array alone slows the page down even with the leak fixed. Every render copies the array and re-renders the whole list. Cap it (`m.slice(-500)`), or virtualize the list, or both.

**StrictMode double-invocation.** In development, React 18+ mounts, unmounts, and remounts effects on purpose, to surface this exact bug. Two sockets in dev and one in production means StrictMode is telling you the cleanup is missing or incomplete. It is not a false alarm to work around.

## How to confirm it

Open DevTools, Network tab, filter to WS, and leave the page running. One socket is correct. A list that grows is your answer. For the shared-client case, log `socket.listenerCount("message")` on an interval instead. A number that climbs is the same finding.
