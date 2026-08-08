---
kind: eval-artifact
run: 5
variant: F
replicate: r5
task: T4
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
## What is likely wrong with my page?

Your effect opens a new websocket connection every time it runs and never closes the old ones. Connections pile up. Each one keeps delivering messages, each message triggers a state update, and the page does the same work several times over. The slowdown grows with how long the page has been open, which is exactly the shape of a leak.

The usual cause is a missing cleanup function. `useEffect` lets you return a function that React calls before the next run and again when the component unmounts. Without it, nothing tears down what the effect built.

```js
useEffect(() => {
  const socket = new WebSocket(url)
  socket.onmessage = (e) => setMessages((m) => [...m, e.data])
}, [url])
```

That opens a socket. Nothing ever closes it.

The second cause is a dependency array that changes on every render. React re-runs an effect when any value in the array differs from last time, compared by identity. An object, array, or function created inline in the component body is a new value each render, so the effect re-runs constantly. With no cleanup, that is a new socket per render.

## How do I confirm it?

Open the Network tab and filter to WS. You should see one connection. If you see a growing list, that is the bug, and the count tells you how many times the effect ran.

Add a `console.log` in the effect body too. A log that repeats without you changing anything points at an unstable dependency.

## How do I fix it?

Return a cleanup function that closes the socket.

```js
useEffect(() => {
  const socket = new WebSocket(url)
  socket.onmessage = (e) => setMessages((m) => [...m, e.data])
  return () => socket.close()
}, [url])
```

Then stabilize the dependencies. Keep only primitives — strings, numbers, booleans — in the array where you can. If you must depend on an object or a callback, wrap it in `useMemo` or `useCallback` in the parent so its identity holds steady across renders.

Guard against the out-of-order case as well. If `url` changes fast, an old socket can deliver a message after you have moved on. Track whether the effect is still current and drop late messages:

```js
useEffect(() => {
  let live = true
  const socket = new WebSocket(url)
  socket.onmessage = (e) => { if (live) setMessages((m) => [...m, e.data]) }
  return () => { live = false; socket.close() }
}, [url])
```

Two more things worth checking once the sockets are fixed. An unbounded message array grows without limit and eventually slows rendering on its own — cap it, or keep only what you display. And if the socket should outlive the component, move it out of the effect entirely and into a module-level client or a context provider, so mounting and unmounting the component does not touch the connection at all.
