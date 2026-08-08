---
kind: eval-artifact
run: 1
variant: B
replicate: r1
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You're almost certainly leaking subscriptions. The effect grows over time, which is the tell — every re-render adds another listener and none of them ever go away.

Two things cause this:

**1. No cleanup function.** `useEffect` runs your subscribe code, but if you don't return a function that unsubscribes, React has no way to undo it. Every time the effect re-runs you get another live socket handler stacked on the previous ones. After an hour of the page being open you might have hundreds, all firing on every message, all doing state updates, all holding references to stale closures so nothing gets garbage collected.

**2. A dependency array that changes every render.** Even with cleanup, if a dependency is a new object or function each render, the effect tears down and re-subscribes constantly — churn instead of accumulation, but still bad.

The shape you want:

```jsx
useEffect(() => {
  const socket = new WebSocket(url)
  socket.addEventListener("message", handleMessage)

  return () => {
    socket.removeEventListener("message", handleMessage)
    socket.close()
  }
}, [url])
```

The returned function is the cleanup. React calls it before re-running the effect and when the component unmounts.

**Things to check while you're in there:**

- **Is `handleMessage` defined inline?** If so it's a new function each render — fine here since you remove the same reference you added, but if it's in the dependency array it'll cause the churn problem. Wrap it in `useCallback` or move it inside the effect.
- **Are you appending to an array in state?** `setMessages(prev => [...prev, msg])` with no bound grows forever. On a chatty socket that alone will slow the page down. Cap it: `[...prev, msg].slice(-500)`.
- **Any `setInterval` or `setTimeout` for heartbeats/reconnects?** Same rule — clear them in the cleanup.

**How to confirm:** open DevTools, take a heap snapshot, leave the page for a few minutes, take another and compare. If listener or object counts are climbing steadily, that's your leak. You can also just `console.log` in the subscribe path and watch it fire more than once.

One gotcha: in React 18+ StrictMode, effects run twice on mount in development. That's intentional — it's specifically there to surface missing cleanup. If double-mounting breaks things, that's a signal, not noise.
