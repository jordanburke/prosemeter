---
kind: eval-artifact
run: 5
variant: A
replicate: r1
task: T4
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
The effect is almost certainly opening a new websocket subscription without closing the old one. Every time it re-runs you gain another live listener, all of them fire on every message, and the work per message grows without bound. That is why the page degrades with time rather than being slow from the start.

## The two shapes this takes

**No cleanup function.** The effect subscribes and returns nothing:

```jsx
useEffect(() => {
  socket.on("message", handleMessage)
}, [roomId])
```

Each time `roomId` changes, a new handler is added and the previous one stays attached. After ten room switches, one incoming message runs ten handlers, ten state updates, ten renders.

**Cleanup exists but unsubscribes the wrong thing.** This one is sneakier:

```jsx
useEffect(() => {
  socket.on("message", (m) => setMessages((prev) => [...prev, m]))
  return () => socket.off("message", (m) => setMessages(...))
}, [])
```

`off` needs the same function reference that `on` was given. Two separate arrow literals are two different references, so the removal silently does nothing and the leak is identical to having no cleanup at all.

A third variant: the effect creates a whole new `WebSocket` each run and never calls `close()`. Now you leak sockets as well as handlers, and the browser eventually caps you at its per-host connection limit.

## Why the dependency array is usually the trigger

An effect with a correct dependency array runs when those dependencies change. If one of the dependencies is a value recreated on every render — an inline object, an array literal, a function defined in the component body — the array is different on every render by identity, the effect tears down and re-runs constantly, and any flaw in cleanup compounds every frame instead of every user action.

```jsx
useEffect(() => { /* subscribe */ }, [{ roomId }])  // new object each render
useEffect(() => { /* subscribe */ }, [onMessage])   // new function each render
```

So there are two independent questions: does the effect clean up correctly, and does it re-run more often than it should.

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

Three things matter here. The handler is a named binding, so `addEventListener` and `removeEventListener` see the same function. The cleanup closes the socket, not just the listener. And the dependency array holds a primitive, so the effect re-runs only when the URL genuinely changes.

If the socket is shared across the app, do not create it in the effect. Create it once — a module singleton, a context provider, or a library like `react-use-websocket` — and let the effect only add and remove its own listener. Otherwise every component that mounts opens a connection.

Use the functional form of `setState` inside the handler, as above. `setMessages(prev => ...)` reads the current value at update time, so the handler does not need `messages` in scope and `messages` does not need to be a dependency. Without it you either capture a stale array or add `messages` to the deps and resubscribe on every single message — which is its own version of the same bug.

## Confirming it before you change anything

React 18's Strict Mode mounts every effect twice in development specifically to expose missing cleanup. If the page behaves noticeably worse in dev than in production, that is the tell.

To measure it directly, open DevTools, go to the Network tab, and filter to WS. You should see one socket per intended connection; a growing list is the leak. For listeners, log the count inside the handler:

```jsx
const handleMessage = (event) => {
  console.count("message handler")
  ...
}
```

If one incoming message prints an increasing count, you have accumulating subscriptions and the fix above is the right one.

## The general rule

Any effect that acquires something must return a function that releases it. Subscriptions, timers, intervals, observers, abort controllers, event listeners on `window` — all the same shape. If the body of your effect contains `on`, `add`, `subscribe`, `setInterval`, or `new`, the effect needs a `return`.
