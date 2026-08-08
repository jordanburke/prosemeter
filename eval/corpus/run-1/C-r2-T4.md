---
kind: eval-artifact
run: 1
variant: C
replicate: r2
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Almost certainly your effect opens a socket and never closes it. Each time the dep array trips, React runs the effect again and opens one more. The old sockets stay live. They keep their handlers, and each handler pins a whole stale render in memory. Ten minutes in, you have dozens of sockets, all firing `setState` on the same component.

**Fix one: return a cleanup function.**

```tsx
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = (e) => setData(JSON.parse(e.data))
  return () => ws.close()
}, [url])
```

**Fix two: sort out the dep array.** Two traps show up over and over.

- *An object or function in the deps.* `[options]` or `[onMessage]` gets built fresh on every render, so React sees a new value and rebuilds the socket each time. Keep the deps to plain values like `url`, and stash the handler in a `useRef` you update in a separate effect.
- *A dep the socket itself changes.* If `data` sits in the deps and each message sets `data`, you have made a loop that reconnects forever.

**Then check for state that only grows.** This line is the other half of most slow-over-time pages:

```tsx
setMessages(prev => [...prev, msg])
```

That array never shrinks. At ten messages a second, an hour gives you 36,000 items, and if you render them all, 36,000 DOM nodes. Cap it, or virtualize the list:

```tsx
setMessages(prev => [...prev.slice(-200), msg])
```

**To tell which one you have:** open DevTools, go to Memory, take a heap snapshot, wait two minutes, take another, and diff them. More `WebSocket` objects means leaked sockets. One fat array means state that only grows.

One heads-up: StrictMode in dev mounts each effect twice on purpose. That is not your bug — it is React showing you the missing cleanup early.
