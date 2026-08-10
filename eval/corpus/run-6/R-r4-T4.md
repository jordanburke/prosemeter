---
kind: eval-artifact
run: 6
variant: R
replicate: r4
task: T4
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

The effect re-runs and opens a new subscription each time. It never closes the old one. Every re-run leaves a live listener behind, so the count grows the longer the page stays open.

## Why this shows up as gradual slowness

Each stale subscription still holds its socket handler, and each handler still fires. After twenty re-runs, one incoming message triggers twenty callbacks, twenty state updates, and twenty renders. The page does not break. It does more work per message, forever.

The handlers also capture their surrounding scope. The old component state, the old props, and any data those closures reference all stay reachable. The garbage collector cannot reclaim them. Memory climbs alongside the CPU cost.

That is the signature: fine at first, sluggish after five minutes, unbearable after an hour.

## The two ways it happens

**No cleanup function.** The effect opens the socket and returns nothing.

```jsx
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = (e) => setMessages((m) => [...m, JSON.parse(e.data)])
}, [url])
```

**Unstable dependencies.** A cleanup exists, but the dependency array holds a value that is a new object or function on every render. The effect tears down and rebuilds constantly.

```jsx
useEffect(() => { /* ... */ }, [options])   // options = {} rebuilt every render
```

The second is sneakier, because the code reads as correct. React compares dependencies with `Object.is`. A fresh object literal never equals the previous one, so the effect runs every render. If the effect also sets state, you have a loop that reconnects as fast as the browser allows.

## The fix

Return a cleanup function. React calls it before the next run and on unmount.

```jsx
useEffect(() => {
  const ws = new WebSocket(url)

  const handleMessage = (e) => {
    setMessages((m) => [...m, JSON.parse(e.data)])
  }

  ws.addEventListener("message", handleMessage)

  return () => {
    ws.removeEventListener("message", handleMessage)
    ws.close()
  }
}, [url])
```

Now the effect owns exactly one socket at a time. `url` changes, the old socket closes, a new one opens. The component unmounts, the socket closes.

Note the state updater form — `setMessages((m) => ...)` instead of `setMessages([...messages, x])`. The second reads `messages` from the closure. That forces you to list it as a dependency, which reconnects the socket on every message. The updater form reads nothing from the closure and keeps state out of the dependency array.

## Fixing the dependency side

Get non-primitive dependencies out of the array, or make them stable.

- Inline the object inside the effect if only the effect uses it.
- Depend on the primitive fields — `[options.roomId, options.token]` — not the object.
- Wrap a function dependency in `useCallback`, and a computed object in `useMemo`, where they are created.

Turn on `react-hooks/exhaustive-deps` in ESLint if you have it off. It catches the missing-dependency half of this bug class. It cannot catch the unstable-dependency half, so you still have to look.

## Confirming the diagnosis before you fix it

Check, do not assume. Two checks take a minute each.

Log in both directions and watch the console:

```jsx
useEffect(() => {
  console.log("connecting")
  const ws = new WebSocket(url)
  return () => { console.log("closing"); ws.close() }
}, [url])
```

If "connecting" prints repeatedly with no matching "closing", you have your answer.

Or open DevTools, go to the Network tab, and filter to WS. Every open websocket shows as a row. One row is correct. A growing list is the leak, visible directly.

For the memory side, take two heap snapshots five minutes apart and compare retained objects. Growing counts of the same component or closure confirm that nothing is released.

## One thing that is not the bug

In development with StrictMode on, React deliberately mounts, unmounts, and remounts every component once. You will see two connections at startup. That is React checking your cleanup, not a leak, and it does not happen in production builds. If the count stays at two and stops, you are fine. If it keeps climbing, you are not.

## Extracting it

Once it works, move it into a hook so the next feature gets the cleanup for free.

```jsx
function useWebSocket(url, onMessage) {
  const handlerRef = useRef(onMessage)
  useEffect(() => { handlerRef.current = onMessage })

  useEffect(() => {
    const ws = new WebSocket(url)
    const listener = (e) => handlerRef.current(e)
    ws.addEventListener("message", listener)
    return () => {
      ws.removeEventListener("message", listener)
      ws.close()
    }
  }, [url])
}
```

The ref keeps the latest callback reachable without putting it in the dependency array. A caller passing an inline arrow function no longer reconnects the socket on every render.

If the app opens three or more sockets, or needs reconnect-with-backoff, reach for a library instead of growing this. Fix the cleanup first. That is the whole bug.
