---
kind: eval-artifact
run: 5
variant: E
replicate: r3
task: T4
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect is almost certainly subscribing more than once and never unsubscribing. Each run adds another listener, the old ones stay alive, and the page gets slower as they pile up.

Two things cause this, and you may have both.

The effect has no cleanup function. React runs the effect body on mount and after any run where a dependency changed, but it only tears down what you return. If you call `socket.addEventListener("message", handler)` and return nothing, that handler is never removed. Every re-run stacks another one, so one incoming message fires ten handlers, then a hundred. Each handler closes over the state it saw when it was created, so old ones also hold stale data and keep it from being garbage collected.

The dependency array re-runs the effect too often. An unstable dependency — an object literal, an inline function, an array built in the render body — is a new reference on every render, so the effect tears down and rebuilds on every render. With a websocket that means reconnecting constantly, which is its own kind of slow.

Also expect this to run twice on mount in development. React 18's StrictMode mounts, unmounts, and remounts on purpose to expose exactly this missing cleanup. That is the bug showing itself, not causing it.

Here is the fix.

Return a cleanup function that removes what the effect added.

```js
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

Three details in that snippet carry the weight.

The dependency array holds only `url`, a string. Strings compare by value, so the effect re-runs only when the URL actually changes.

The handler uses the updater form of `setMessages`. Without it you would need `messages` in the dependency array, which would rebuild the socket on every message — the worst version of this bug.

The cleanup closes the socket, not just the listener. An open socket keeps its own resources and keeps reconnecting if you have retry logic.

Confirm the diagnosis before and after. Open DevTools, watch the Network tab's WS section, and count connections as you interact with the page. One connection that stays put is right. A growing list is the bug. For handler buildup, take two heap snapshots a minute apart and compare retained closures.

Two things worth doing next.

Move the socket out of the component if several components need it. A module-level singleton or a context provider gives you one connection and one place to manage its lifetime.

Guard against a late message arriving after unmount. If your handler calls `setState` on a component that is gone, React warns. The cleanup above already prevents it, which is another reason to write it.
