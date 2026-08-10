---
kind: eval-artifact
run: 6
variant: P
replicate: r1
task: T4
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

The effect is opening a new websocket subscription without closing the old one. Every re-run adds another live listener, all of them fire on every message, and the work per message grows without bound. That is why the page degrades over time instead of being slow from the start.

## The two shapes this takes

**No cleanup function.** The effect subscribes and returns nothing:

```jsx
useEffect(() => {
  socket.on("message", handleMessage)
}, [roomId])
```

Each time `roomId` changes, a new handler attaches and the old one stays. After ten room switches, one incoming message runs ten handlers, ten state updates, ten renders.

**Cleanup exists but removes the wrong thing.** This one is sneakier:

```jsx
useEffect(() => {
  socket.on("message", (m) => setMessages((prev) => [...prev, m]))
  return () => socket.off("message", (m) => setMessages(...))
}, [])
```

`off` needs the same function reference `on` was given. Two arrow literals are two different references, so the removal silently does nothing and the leak matches having no cleanup at all.

A third variant: the effect builds a new `WebSocket` on every run and never calls `close()`. Now you leak sockets as well as handlers, and the browser eventually caps you at its per-host connection limit.

## Why the dependency array is usually the trigger

An effect re-runs when its dependencies change. If a dependency is recreated on every render — an inline object, an array literal, a function defined in the component body — the array differs by identity every render, the effect tears down and re-runs constantly, and any flaw in cleanup compounds every frame instead of every user action.

```jsx
useEffect(() => { /* subscribe */ }, [{ roomId }])  // new object each render
useEffect(() => { /* subscribe */ }, [onMessage])   // new function each render
```

So there are two separate questions: does the effect clean up correctly, and does it re-run more often than it should.

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

Three things carry the weight here. The handler is a named binding, so `addEventListener` and `removeEventListener` see one function. The cleanup closes the socket, not just the listener. The dependency array holds a primitive, so the effect re-runs only when the URL really changes.

If the socket is shared across the app, do not create it in the effect. Create it once — a module singleton, a context provider, or a library such as `react-use-websocket` — and let the effect add and remove only its own listener. Otherwise every mounted component opens a connection.

Use the functional form of `setState` inside the handler, as above. `setMessages(prev => ...)` reads the current value at update time, so the handler never needs `messages` in scope and `messages` never needs to be a dependency. Without it you either capture a stale array or add `messages` to the deps and resubscribe on every single message, which is the same bug wearing a different hat.

## Confirm it before you change anything

React 18's Strict Mode mounts every effect twice in development, precisely to expose missing cleanup. If the page behaves clearly worse in dev than in production, that is the tell.

To measure it, open DevTools, go to the Network tab, and filter to WS. You should see one socket per intended connection; a growing list is the leak. For listeners, count them in the handler:

```jsx
const handleMessage = (event) => {
  console.count("message handler")
  ...
}
```

If one incoming message prints a rising count, subscriptions are accumulating and the fix above is the right one.

## The general rule

Any effect that acquires something must return a function that releases it. Subscriptions, timers, intervals, observers, abort controllers, listeners on `window` — all one shape. If the effect body contains `on`, `add`, `subscribe`, `setInterval`, or `new`, the effect needs a `return`.
