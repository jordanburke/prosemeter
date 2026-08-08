---
kind: eval-artifact
run: 5
variant: F
replicate: r3
task: T4
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
## What is likely wrong?

Your effect opens a new websocket subscription every time it runs and never closes the old one. Subscriptions pile up, so the page does the same work several times over and gets slower the longer it stays open.

`useEffect` runs its function after render. It runs again whenever a value in the dependency array changes. It runs the function you *return* — the cleanup — before each re-run and once when the component unmounts. If you return nothing, nothing gets undone.

That gives the common broken shape:

```jsx
useEffect(() => {
  socket.subscribe("prices", handleMessage)
}, [handleMessage])
```

Every run adds a handler. None removes one. After twenty runs, one incoming message calls twenty handlers, each setting state, each triggering a render. The cost grows with how long the page has been open, which is exactly the symptom you describe.

Two things make it worse. The dead handlers hold on to the props and state from the render that created them, so nothing they captured can be freed — that is the memory growth. And each one calls `setState`, so React re-renders once per handler per message.

## Why does the effect re-run so often?

Because a dependency changes identity on every render.

React compares dependencies by reference, not by contents. A function or object created in the component body is a new value each render, even when the code is identical. So `[handleMessage]` with `handleMessage` defined inline means "re-run every render". An empty array means "run once".

This is why the leak grows fast. The effect is not re-running on real changes; it is re-running on every render, and every render adds a subscription.

## How do I fix it?

Return a cleanup function that undoes exactly what the effect did.

```jsx
useEffect(() => {
  const handle = (msg) => setPrice(msg.price)
  socket.subscribe("prices", handle)
  return () => socket.unsubscribe("prices", handle)
}, [socket])
```

Now each run is paired with a teardown. React runs the cleanup before the next run and on unmount, so at most one subscription exists at a time.

Three details decide whether this actually holds:

- **Unsubscribe the same reference you subscribed.** `unsubscribe` matches on function identity. Defining the handler inside the effect, as above, guarantees the match.
- **Keep the dependencies stable.** `socket` must be the same object across renders — hold it in a `useRef`, a context, or a module-level singleton. If it is created in the component body, the effect still tears down and rebuilds on every render, which is correct but wasteful.
- **If you own the socket, close it.** When the effect creates the connection rather than borrowing one, the cleanup must call `socket.close()`, and the handler should be attached with `addEventListener` and removed with `removeEventListener` on the same function reference.

## How do I confirm it is fixed?

Count the subscriptions, do not eyeball the page.

Log the length of the listener list inside the effect, or increment a module counter on subscribe and decrement on unsubscribe. Leave the page open, interact with it, and watch the number. It should sit at one. Rising means you still have a leak.

Two tools help. Chrome DevTools' Performance monitor shows a live listener and node count; a line that only goes up is the tell. React DevTools' Profiler shows how many components rendered per message — if one message causes many renders, duplicate handlers are still firing.

Turn on React's Strict Mode in development while you work on this. In development it deliberately mounts, unmounts, and remounts each component once, which makes a missing cleanup fail immediately instead of an hour later.
