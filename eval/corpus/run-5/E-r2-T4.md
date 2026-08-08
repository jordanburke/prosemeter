---
kind: eval-artifact
run: 5
variant: E
replicate: r2
task: T4
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect is almost certainly opening a new websocket subscription without closing the old one. Subscriptions pile up, each one holding a handler that touches state, and the page gets slower with every extra listener.

The mechanism is simple. `useEffect` runs its body after render. It runs again whenever a value in the dependency array changes. If the body subscribes and nothing unsubscribes, the second run adds a second subscription on top of the first. Ten re-renders later you have ten live handlers, and every message arriving on the socket fires all ten.

The cost compounds three ways. Each handler runs on each message, so CPU work scales with the number of leaked subscriptions. Each closure pins the props and state from the render that created it, so memory grows and old objects never get collected. And each handler that calls `setState` triggers its own render pass, so one message can cause ten renders.

Fix it by returning a cleanup function from the effect. React calls it before the next run and once on unmount.

```jsx
useEffect(() => {
  const socket = new WebSocket(url)
  const onMessage = (e) => setData(JSON.parse(e.data))
  socket.addEventListener("message", onMessage)
  return () => {
    socket.removeEventListener("message", onMessage)
    socket.close()
  }
}, [url])
```

Two details that catch people.

Remove the exact same function reference you added. `addEventListener("message", (e) => ...)` followed by `removeEventListener("message", (e) => ...)` removes nothing, because those are two different functions. Name the handler, as above.

Check the dependency array for values that are new on every render. An object literal, an array literal, or an inline function passed down as a prop gets a fresh identity each render, so the effect tears down and rebuilds the socket constantly. Depend on the primitive — the url string, the id — rather than the object containing it, or wrap the object in `useMemo` at the source.

Confirm the diagnosis before you change anything. Open DevTools, go to the Memory tab, and take heap snapshots a minute apart while the page sits idle; a growing count of the same object type is the leak. The Performance tab will also show the listener count climbing. And in React 18 Strict Mode, development runs every effect twice on mount on purpose — that is React checking whether your cleanup works, not a bug.

One thing to rule out. If your effect is clean and the page still degrades, look for an unbounded array — a message log you append to and never trim. That produces the same slow-creep symptom and has nothing to do with the subscription.
