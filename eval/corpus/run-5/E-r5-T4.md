---
kind: eval-artifact
run: 5
variant: E
replicate: r5
task: T4
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect is almost certainly opening a new websocket subscription on every run and never closing the old one. Subscriptions pile up, each one still firing handlers, and the page gets heavier the longer it sits.

## Why it happens

A `useEffect` runs its body after render. It runs again whenever a value in its dependency array changes. It runs the function you return — the cleanup — before each re-run and once on unmount.

If you never return a cleanup, nothing tears down the old subscription. Two things then grow without bound.

**Handlers.** Each subscription registers a listener. After ten runs, one incoming message calls ten handlers, each calling `setState`. Renders multiply, and each render triggers the effect again if its deps are unstable.

**Memory.** Every closure holds the props and state from the render that created it. None of it can be collected while the socket still references the handler.

The slowdown compounds because the two feed each other. More handlers cause more renders, and more renders create more handlers.

## The fix

Return a cleanup that undoes exactly what the effect did.

```jsx
useEffect(() => {
  const socket = new WebSocket(url)
  socket.addEventListener("message", handleMessage)
  return () => {
    socket.removeEventListener("message", handleMessage)
    socket.close()
  }
}, [url])
```

Two rules make this work.

**Clean up everything the effect created.** Remove the listener and close the socket. Removing only the listener leaves the connection open, and browsers cap concurrent connections.

**Undo it in the same scope that created it.** The cleanup closes over `socket`, so each run tears down its own socket rather than whatever the latest one happens to be.

## Check the dependency array too

A correct cleanup with a bad dependency array still churns. It will connect and disconnect on every render instead of leaking, which is its own problem — the server sees a reconnect storm.

The usual cause is an inline function or object in the deps.

```jsx
}, [url, options])   // options = {} recreated every render → reconnects every render
```

Depend on primitives. Pass `url` and a couple of scalars, not an object literal. If you need a callback inside the effect and do not want it in the deps, keep it in a ref and update the ref in its own effect.

## How to confirm it before you change anything

Open DevTools, go to the Network tab, filter to WS, and watch the list while the page runs. One connection that stays open is right. A growing list is the leak.

For the memory side, take a heap snapshot, use the page for a minute, take a second snapshot, and compare. A detached-node count or closure count that climbs and never drops confirms it.

## After the fix

Consider hoisting the socket out of the component entirely. One module-level connection, shared through context, with components subscribing to messages, removes a whole class of this bug — components mount and unmount far more often than a connection should.
