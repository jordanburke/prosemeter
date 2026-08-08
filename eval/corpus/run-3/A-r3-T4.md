---
kind: eval-artifact
run: 3
variant: A
replicate: r3
task: T4
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Almost certainly the effect isn't cleaning up its subscription, so you're accumulating listeners. Every time the effect re-runs you add a new one, none of the old ones go away, and every incoming message now runs N handlers instead of one. The page gets slower in proportion to how long it's been open — which matches your symptom exactly.

The shape that causes it:

```jsx
useEffect(() => {
  socket.on("message", handleMessage)
}, [someValue])   // ← no cleanup, and re-runs when someValue changes
```

The fix is the return function:

```jsx
useEffect(() => {
  const handleMessage = (e) => { /* ... */ }
  socket.on("message", handleMessage)
  return () => socket.off("message", handleMessage)   // ← this
}, [someValue])
```

Note that `off` needs *the same function reference* you passed to `on`. Defining the handler inside the effect body, as above, is the reliable way to get that — if you're doing `socket.on("message", (e) => ...)` inline, there's no reference left to remove and cleanup silently does nothing.

Same story if you're creating the socket in the effect rather than subscribing to a shared one — then cleanup is `socket.close()`, and without it you're leaking whole connections, which is worse.

Two things to check next:

**Is the effect re-running more than you think?** Look at the dependency array. If it contains an object, array, or function defined in the component body, it's a new reference every render, so the effect tears down and rebuilds on *every* render. With cleanup that's merely wasteful; without it, it's your leak accelerating. Fix by depending on primitives, or memoizing the dependency.

**Are you appending messages to state without bound?** A second, very common cause of "slower the longer it's open" is:

```jsx
setMessages(prev => [...prev, msg])
```

After an hour that array is huge, and if you render all of it, React is diffing thousands of nodes on every message. Cap it (`[...prev, msg].slice(-500)`) or virtualize the list.

To confirm which one you've got: open DevTools → Performance, record for 30s on a fresh page and 30s after it's been open a while, and compare. If the same message is triggering many handler invocations, it's the listener leak. If handler count is flat but render time grows, it's the unbounded array. Chrome's Memory profiler with two heap snapshots will show detached listeners piling up too.

Worth turning on `react-hooks/exhaustive-deps` in ESLint if it isn't already — it won't catch missing cleanup, but it catches most of the reasons effects re-run when you didn't expect them to.
