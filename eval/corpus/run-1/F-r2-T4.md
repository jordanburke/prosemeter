---
kind: eval-artifact
run: 1
variant: F
replicate: r2
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect is subscribing more than once and never unsubscribing. Every re-run stacks another live listener on the socket.

**What's happening**

A `useEffect` runs again whenever a dependency changes. Without a cleanup function, the old subscription stays alive alongside the new one.

So after ten re-runs you have ten listeners. Each incoming message fires all ten handlers, each triggers a state update, and each update can re-run the effect again. Work per message grows linearly with how long the page has been open. That's the slowdown you're seeing.

The old handlers also hold their captured props and state in closure, so nothing gets garbage collected. Memory climbs alongside CPU.

**The two likely causes**

**No cleanup.** The effect opens or subscribes and returns nothing.

**Unstable dependencies.** You have cleanup, but a dependency changes on every render — an inline object, an array literal, or a handler function defined in the component body. React compares dependencies by reference, so a fresh object each render means the effect tears down and re-subscribes constantly. That churns rather than leaks, but it still hurts.

**How to confirm it**

Open DevTools and watch the WebSocket frames, or log inside the subscribe call. If you see the subscribe line print repeatedly as the page sits idle, you've found it. React's StrictMode in development mounts effects twice on purpose — that's the same bug surfacing early, not a false alarm.

**The fix**

Return a cleanup function that undoes exactly what the effect did:

```tsx
useEffect(() => {
  const socket = new WebSocket(url)
  const onMessage = (e: MessageEvent) => setData(JSON.parse(e.data))
  socket.addEventListener("message", onMessage)

  return () => {
    socket.removeEventListener("message", onMessage)
    socket.close()
  }
}, [url])
```

Three things matter here:

- **The cleanup mirrors the setup.** Every `addEventListener` gets a `removeEventListener`. Every open gets a close.
- **The dependency array holds only primitives.** `url` is a string, so it compares by value. If you must depend on a function, wrap it in `useCallback` first.
- **The handler reads state via the updater form** — `setData(prev => ...)` — so it doesn't need `data` as a dependency.

**If the socket is shared**

Don't open a connection per component. Create one connection outside React, or in a context provider mounted once at the root. Components then subscribe and unsubscribe against that single socket. This avoids N connections when N components mount, and it survives re-renders cleanly.
