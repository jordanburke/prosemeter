---
kind: eval-artifact
run: 3
variant: A
replicate: r5
task: T4
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Near-certain diagnosis: **the effect isn't cleaning up its subscription, so you're accumulating websocket listeners.** Every time the effect re-runs it opens a new subscription and the old one stays alive. After an hour you have hundreds of handlers all firing on every message, each triggering a state update, each triggering a render.

The tell is that it degrades with *time open* rather than with data volume — that's accumulation, not an expensive render.

The shape that causes it:

```jsx
useEffect(() => {
  socket.on("message", handleMessage)
}, [someValue])   // no cleanup, and a dep that changes
```

Two failure modes here and they compound:

1. **No cleanup function.** The effect never unsubscribes, so re-runs stack.
2. **An unstable dependency.** If a dep is a new object/array/function each render, the effect re-runs on *every* render, so the stacking is fast. With `[]` you'd leak only once, which is bad but not degrading.

### The fix

Always return a cleanup that undoes exactly what the effect did:

```jsx
useEffect(() => {
  const handleMessage = (msg) => { /* ... */ }
  socket.on("message", handleMessage)
  return () => socket.off("message", handleMessage)
}, [socket])
```

Note `socket.off` gets the *same function reference* — if `handleMessage` is defined inside the effect, that's automatic. If you pass an inline arrow to both `on` and `off`, they're different functions and the unsubscribe silently does nothing. That's a common near-miss: cleanup exists, looks right in review, removes nothing.

If you're creating the connection in the effect rather than receiving it, close it too:

```jsx
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = (e) => setData(JSON.parse(e.data))
  return () => ws.close()
}, [url])
```

### Then stabilize the deps

Check what's in the dep array. If it includes a callback or object defined in the parent's render body, it's new every time and the effect churns. Fix it at the source — `useCallback`/`useMemo` in the parent, or move the value out of the component if it's actually constant. Don't fix it by deleting deps from the array; that trades a leak for a stale closure.

### Confirming it

React 18+ StrictMode in dev intentionally mounts, unmounts, and remounts effects to surface exactly this bug — if it's misbehaving under StrictMode, that's your confirmation. Otherwise, throw a `console.log` in the effect body and watch the count climb, or open DevTools → Memory and take two heap snapshots ten minutes apart and diff the retained listener count.

One more thing worth checking while you're in there: if `handleMessage` does `setMessages(prev => [...prev, msg])` on a high-frequency stream, the array grows unbounded and rendering it gets slower over time even with cleanup done correctly. Cap it, window it, or virtualize the list. Both problems produce the same "slower the longer it's open" symptom, and it's entirely possible you have both.
