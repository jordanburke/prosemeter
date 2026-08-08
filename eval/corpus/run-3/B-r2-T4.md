---
kind: eval-artifact
run: 3
variant: B
replicate: r2
task: T4
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You're almost certainly leaking subscriptions. The effect opens a websocket connection and never closes it, so every time the effect re-runs you get another live connection stacked on the last one. Nothing tears the old ones down. An hour in, you have dozens of sockets all pushing messages into handlers that all call `setState`, and the page crawls.

The two things to check:

**1. Is there a cleanup function?** An effect that subscribes must return a function that unsubscribes:

```js
useEffect(() => {
  const socket = new WebSocket(url)
  socket.addEventListener("message", handleMessage)

  return () => {
    socket.removeEventListener("message", handleMessage)
    socket.close()
  }
}, [url])
```

That returned function is what React calls before re-running the effect and when the component unmounts. Without it, nothing ever disconnects.

**2. What's in the dependency array?** This is usually the real culprit, and it's sneakier. If a dependency changes on every render, the effect tears down and re-subscribes constantly — which is churn even if cleanup is correct, and an unbounded leak if it isn't.

The classic version is an object or function defined in the component body:

```js
const options = { room: roomId }        // new object every render
useEffect(() => { ... }, [options])     // so this runs every render
```

Fix it by depending on the primitive (`roomId`) instead of the object, or wrap the object in `useMemo` / the function in `useCallback`. An empty array `[]` means "subscribe once on mount" — correct if the connection genuinely never needs to change, but make sure the handler isn't closing over stale state, because it will capture the values from the first render forever.

**How to confirm it's this** before you change anything: open DevTools → Network → WS and watch the connection list while you use the page. If connections accumulate instead of staying at one, that's your answer. You can also log in the cleanup function — if it never fires, cleanup isn't running.

One related thing worth a look while you're in there: if the socket handler is appending messages to an array in state and nothing ever trims it, the page will also slow down purely from that array growing. Different cause, same symptom, and the two often ship together.
