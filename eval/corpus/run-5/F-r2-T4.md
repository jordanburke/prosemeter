---
kind: eval-artifact
run: 5
variant: F
replicate: r2
task: T4
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
## What is likely wrong?

Your effect opens a new websocket subscription every time it runs, and never closes the old one.

The subscriptions pile up. After ten runs you have ten live sockets, ten sets of handlers, and every incoming message fires ten times. Each duplicate handler also holds a reference to the state and props from the render that created it, so React cannot release that memory. Both effects — the CPU work and the retained memory — grow with how long the page stays open, which matches what you are seeing.

Two mistakes cause this, and you may have both.

**No cleanup function.** An effect can return a function, and React runs it before the next run of that effect and again when the component unmounts. If your effect returns nothing, nothing ever closes the socket.

**An unstable dependency.** Even with cleanup, an effect that re-runs constantly churns sockets hard. It re-runs whenever a value in its dependency array changes by identity, and an object, array, or function created during render is a new value on every render. So a dependency like `options={{ room }}` or an inline `onMessage` handler makes the effect re-run every render, tearing down and rebuilding the socket each time.

## How do I fix it?

Return a cleanup function, and make the dependencies stable.

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

The cleanup closes the socket and drops the handler. The dependency array holds only `url`, a string, which compares by value and so does not change unless the URL really changes.

If you need an object or a function in the effect, do one of these:

- **Move it inside the effect.** A value created in the effect body is not a dependency at all.
- **Reduce it to primitives.** Depend on `room` and `token`, not on the object holding them.
- **Wrap it.** `useMemo` for a value, `useCallback` for a function, `useRef` for a handler you want to update without restarting the socket.

Two things to check while you are there. Confirm the cleanup runs by logging inside it — you should see one close for every open. Reconnect logic is a common leak of its own, because a timer that schedules a reconnect must be cleared in the cleanup too, or it will resurrect a socket you just closed.

In development with React's Strict Mode, effects run twice on mount on purpose. That is React checking your cleanup, not a bug. Correct cleanup makes the double run harmless.
