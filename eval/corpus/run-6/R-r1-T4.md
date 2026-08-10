---
kind: eval-artifact
run: 6
variant: R
replicate: r1
task: T4
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

The effect opens a new websocket subscription without closing the old one. Every re-run adds another live listener. All of them fire on every message, so the work per message grows without bound. The page degrades with time instead of being slow from the start.

## The two shapes this takes

**No cleanup function.** The effect subscribes and returns nothing:

```jsx
useEffect(() => {
  socket.on("message", handleMessage)
}, [roomId])
```

Each `roomId` change attaches a new handler, and the previous one stays. After ten room switches, one incoming message runs ten handlers, ten state updates, ten renders.

**Cleanup exists, but it unsubscribes the wrong thing.** This one is sneakier:

```jsx
useEffect(() => {
  socket.on("message", (m) => setMessages((prev) => [...prev, m]))
  return () => socket.off("message", (m) => setMessages(...))
}, [])
```

`off` needs the same function reference `on` received. Two arrow literals are two different references. The removal silently does nothing, so the leak matches the no-cleanup case exactly.

A third variant: the effect creates a new `WebSocket` each run and never calls `close()`. Now you leak sockets as well as handlers, and the browser caps you at its per-host connection limit.

## Why the dependency array is the trigger

An effect with a correct dependency array runs when those dependencies change. One dependency may be a value recreated on every render — an inline object, an array literal, a function defined in the component body. Then the array differs on every render by identity. The effect tears down and re-runs constantly. Any flaw in cleanup compounds every frame, not every user action.

```jsx
useEffect(() => { /* subscribe */ }, [{ roomId }])  // new object each render
useEffect(() => { /* subscribe */ }, [onMessage])   // new function each render
```

So ask two independent questions. Does the effect clean up correctly? Does it re-run more often than it should?

## The fix

Return a cleanup that removes exactly what the effect added, using the same reference:

```jsx
useEffect(() => {
  const socket = new WebSocket(url)

  const handleMessage = (event) => {
    setMessages((prev) => [...prev, JSON.parse(event.data)])
  }

  socket.addEventListener("message", handleMessage)

  return () => {
    socket.removeEventListener("message", handleMessage)
    socket.close()
  }
}, [url])
```

Three details matter. The handler is a named binding, so `addEventListener` and `removeEventListener` see one function. The cleanup closes the socket, not only the listener. The dependency array holds a primitive, so the effect re-runs when the URL changes and at no other time.

If the socket is shared across the app, do not create it in the effect. Create it once — a module singleton, a context provider, or a library such as `react-use-websocket`. Let the effect add and remove its own listener, nothing more. Otherwise every mounted component opens a connection.

Use the functional form of `setState` inside the handler, as above. `setMessages(prev => ...)` reads the current value at update time. The handler then needs no `messages` in scope, and `messages` need not be a dependency. Skip it and you face two bad options: capture a stale array, or add `messages` to the deps and resubscribe on every message. The second option is the same bug wearing a different hat.

## Confirming it before you change anything

React 18's Strict Mode mounts every effect twice in development, to expose missing cleanup. If the page behaves worse in dev than in production, that is the tell.

To measure it directly, open DevTools, go to the Network tab, and filter to WS. You should see one socket per intended connection. A growing list is the leak. For listeners, log the count inside the handler:

```jsx
const handleMessage = (event) => {
  console.count("message handler")
  ...
}
```

One incoming message printing a rising count means subscriptions are accumulating, and the fix above is the right one.

## The general rule

Any effect that acquires a resource must return a function that releases it. Subscriptions, timers, intervals, observers, abort controllers, listeners on `window` — one shape covers them all. If the body of your effect has `on`, `add`, `subscribe`, `setInterval`, or `new`, the effect needs a `return`.
