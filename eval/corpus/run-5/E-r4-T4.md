---
kind: eval-artifact
run: 5
variant: E
replicate: r4
task: T4
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect opens a websocket subscription and never closes it. Each time the effect re-runs, it opens another one. The old subscriptions stay live, so the page holds more and more connections and handlers, and every message fans out to all of them.

Look for two mistakes. They usually appear together.

**No cleanup function.** An effect that subscribes must return a function that unsubscribes. React calls that function before the next run and again when the component unmounts.

```jsx
useEffect(() => {
  const socket = new WebSocket(url)
  socket.addEventListener("message", handleMessage)
  return () => socket.close()
}, [url])
```

Without the `return`, nothing ever tears down.

**An unstable dependency.** If a dependency changes identity on every render, the effect re-runs on every render, and you open a socket per render. Objects, arrays, and inline functions are new values each time, even when they hold the same contents.

```jsx
// re-runs every render — options is a new object each time
useEffect(() => { ... }, [options])
```

Pass primitives where you can. Memoize with `useMemo` or `useCallback` where you cannot. Better still, keep the effect's dependency list down to the values that genuinely change the connection — usually just the URL.

Confirm it before you fix it. Open DevTools, go to the Network tab, and filter to WS. You should see one connection. If you see a growing list, that is your answer. The Memory tab tells the same story: take a heap snapshot, use the page for a minute, take another, and compare retained sizes.

Three more things worth checking once the cleanup is in.

**Callbacks captured in the handler go stale.** If your message handler reads state, it reads the state from the render that created it. Keep the handler in a ref and update the ref in a separate effect, so the socket stays open while the handler stays current.

**Unbounded state grows too.** A handler that appends every message to an array leaks memory even with perfect socket hygiene. Cap the list, or keep only what you render.

**Strict Mode in development double-invokes effects on purpose.** It mounts, unmounts, and remounts to surface exactly this bug. If your page behaves in production but doubles up in development, that is not a false alarm — it is Strict Mode telling you the cleanup is missing or incomplete.

Fix the cleanup first. It is the cause in most cases, and it takes one line.
