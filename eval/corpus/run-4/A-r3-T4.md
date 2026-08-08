---
kind: eval-artifact
run: 4
variant: A
replicate: r3
task: T4
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You're almost certainly leaking subscriptions. The effect re-runs, opens a new websocket handler, and never closes the old one — so after an hour you have hundreds of live listeners all firing on every message, each triggering a state update, each triggering a render.

Two separate mistakes usually stack here.

**No cleanup function.** `useEffect` lets you return a teardown function, and React calls it before re-running the effect and on unmount. If you don't return one, nothing ever unsubscribes:

```ts
useEffect(() => {
  const socket = new WebSocket(url)
  socket.onmessage = handleMessage
  return () => socket.close()   // ← this is the part that's missing
}, [url])
```

**Dependency array that changes every render.** Even with cleanup, if your deps include a value that's recreated on each render — an object literal, an inline arrow function, an array — the effect tears down and re-subscribes constantly. That's not a leak in the same sense, but it's a connection storm, and combined with the missing cleanup it's exactly the "gets slower over time" curve you're describing: the count of live handlers grows linearly with time.

To confirm before you fix: open DevTools, log in the effect body and in the cleanup, and watch whether the counts stay balanced. Or check the Network tab's WS section and see how many connections are open. If you see one connection but the message handler is firing N times per message, it's handlers accumulating on a shared socket rather than sockets accumulating — same root cause, slightly different fix (`removeEventListener` rather than `close`).

The fixes, in order:

1. **Return a cleanup function.** Non-negotiable. Close the socket, or `removeEventListener` if the socket is shared and owned elsewhere.
2. **Stabilize the deps.** `url` as a string is fine. If you're passing a config object, either memoize it with `useMemo` or destructure the primitive fields you actually need into the dep array.
3. **Keep the message handler out of the deps.** If the effect depends on `handleMessage` and that function is redefined every render, you're back to churning. Either wrap it in `useCallback` with stable deps, or — cleaner — stash it in a ref and have the socket handler call `ref.current(msg)`, so the subscription is set up exactly once regardless of how often the handler identity changes.
4. **Check Strict Mode isn't confusing you.** In dev, React 18+ deliberately mounts, unmounts, and remounts effects to surface exactly this bug. If you see two connections in dev and one in prod, that's Strict Mode doing its job, not a separate problem — but it means your cleanup works, so don't "fix" it by disabling Strict Mode.

One more thing worth checking while you're in there: if you're accumulating messages into state with `setMessages(prev => [...prev, msg])` and never trimming, that array grows unbounded too, and re-rendering a list of 40,000 items will feel exactly like a leak. Cap it, or window the render. Those two problems produce very similar symptoms and I've seen both in the same component more than once.
