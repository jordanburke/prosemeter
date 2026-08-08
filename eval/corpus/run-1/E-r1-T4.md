---
kind: eval-artifact
run: 1
variant: E
replicate: r1
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
reviewerFinding:
  severity: minor
  foundBy: "opus,sonnet"
  error: "Describes a self-amplifying listener loop that its own code sample contradicts: the shown effect has a stable [url] dep, so it does not re-run per render."
---
Your effect never cleans up its subscription, so you are stacking a new one on every re-render. Ten renders in, ten listeners fire for each message, and every one of them calls `setState`. That triggers another render, which adds another listener. The page gets slower the longer it stays open because the listener count only grows.

The broken shape looks like this:

```jsx
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = (e) => setMessages((m) => [...m, JSON.parse(e.data)])
}, [url])   // no return — the old socket is never closed
```

**Return a cleanup function.** React runs it before the next effect and again on unmount:

```jsx
useEffect(() => {
  const ws = new WebSocket(url)
  const onMessage = (e) => setMessages((m) => [...m, JSON.parse(e.data)])
  ws.addEventListener("message", onMessage)

  return () => {
    ws.removeEventListener("message", onMessage)
    ws.close()
  }
}, [url])
```

**Then check your dependency array**, because that is usually the second half of the bug. An object, array, or inline function in the deps gets a new identity every render, so the effect tears down and reconnects on every single render. Depend on primitives like the URL string. If you need a callback in there, wrap it in `useCallback`, or better, stash it in a ref so the effect does not depend on it at all.

**Confirm it before you call it fixed.** Open DevTools, go to the Network tab, and filter to WS. One connection means you are fine. A growing list means the sockets are still leaking. In the Memory tab, take a heap snapshot, leave the page open for a few minutes, snapshot again, and compare — climbing detached listener counts point at the same leak.

Two things that look like this bug but are not. **Strict Mode in dev** deliberately mounts, unmounts, and remounts every effect once, so you will briefly see two connections locally and one in production; correct cleanup makes that harmless, which is exactly why React does it. And an **unbounded message array** slows the page down on its own, no leak required — cap it with `m.slice(-500)` if you are appending forever.

If several components need the same socket, hoist it into one provider at the top of the tree and let children read from context. One connection, one cleanup path, no chance of each component leaking its own.
