---
kind: eval-artifact
run: 5
variant: F
replicate: r1
task: T4
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect subscribes to the websocket but never unsubscribes, so subscriptions pile up. After an hour the same message runs your handler dozens of times, and every closure it captured is still held in memory. The fix is a cleanup function.

## What is likely wrong?

`useEffect` runs its body every time its dependencies change. If the body adds a listener and nothing removes it, you get one more listener per run, forever.

The classic shape:

```js
useEffect(() => {
  socket.on("message", handleMessage)
}, [handleMessage])
```

Every render that produces a new `handleMessage` adds another listener. The old ones stay. Ten renders means ten listeners, and one incoming message calls your handler ten times. The page gets slower in proportion to how long it has been open, which is exactly what you are seeing.

Two costs stack up:

**Work per message.** Ten listeners means ten handler runs, ten state updates, ten renders. If each render creates another listener, the growth compounds.

**Memory.** Each listener holds a closure. That closure holds the props and state from the render that made it, and anything those reference. None of it can be collected while the listener lives. Old component trees stay in memory long after they left the screen.

There is a second, quieter version of the same bug. If the effect *opens* the connection rather than subscribing to a shared one, you leak whole sockets — each with its own buffers and its own reconnect timer.

## How do I confirm it?

Open Chrome DevTools and take a heap snapshot, use the page for a few minutes, then take another and compare. Growing counts of your component or of closure objects point straight at retained listeners.

Faster check: log inside the handler with a counter. If one message prints a rising number of lines, you have your answer in ten seconds.

Also watch the Performance panel's memory track. A sawtooth that never returns to its old floor means something is held.

## How do I fix it?

Return a cleanup function from the effect. React runs it before the next effect run and once when the component unmounts.

```js
useEffect(() => {
  socket.on("message", handleMessage)
  return () => socket.off("message", handleMessage)
}, [handleMessage])
```

Three things to get right:

**Remove the exact same function reference you added.** `socket.off("message", handleMessage)` only works if `handleMessage` is the same object you passed to `on`. An inline arrow function in both places removes nothing, because the two arrows are different objects.

**Stabilize the dependency, or stop depending on it.** If `handleMessage` is redefined on every render, the effect tears down and re-subscribes on every render. That no longer leaks, but it churns. Wrap the handler in `useCallback` with a real dependency list, or move it inside the effect so the effect depends only on the socket.

**If the effect owns the connection, close it in cleanup.** `return () => socket.close()`. And guard against the connection being reopened by a re-run you did not intend — depend on the URL, not on an object rebuilt each render.

One thing that will confuse you in development: React's Strict Mode deliberately mounts, unmounts, and remounts every component once. If your cleanup is correct, this is invisible. If it is missing, you see doubled behavior immediately. Treat that doubling as the test passing, not as a React bug.

For a socket shared across many components, move the connection out of the component entirely — into a module-level client or a context provider — and let components subscribe and unsubscribe against it. That way component churn never touches the connection itself.
