---
kind: eval-artifact
run: 5
variant: A
replicate: r5
task: T4
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect is subscribing more than once and never unsubscribing. Every re-run of the effect opens another websocket handler, the old ones stay attached, and each incoming message now fires two handlers, then three, then twenty. That is the slowdown, and it compounds the longer the page stays open.

## Why the effect re-runs

`useEffect` re-runs whenever a value in its dependency array changes between renders, using `Object.is` comparison. Two things commonly cause this without anyone intending it:

An object or function is in the deps array and is recreated each render. `{ url }` is a new object every time, so it never equals the previous one, so the effect runs on every single render.

Or the deps array is missing entirely. `useEffect(fn)` with no second argument runs after every render — a subscription there is a leak by construction.

Also worth knowing: in development with React's StrictMode, effects run, clean up, and run again on mount. That is deliberate. It exists to surface exactly this bug.

## The fix: return a cleanup function

An effect can return a function, and React calls it before the next run and again on unmount. Anything the effect opened, the cleanup closes.

```jsx
useEffect(() => {
  const socket = new WebSocket(url)

  const onMessage = (event) => setData(JSON.parse(event.data))
  socket.addEventListener("message", onMessage)

  return () => {
    socket.removeEventListener("message", onMessage)
    socket.close()
  }
}, [url])
```

Now each run has exactly one socket, and it is torn down before the next one opens. Note that `url` is a string, so the comparison is stable.

If you are subscribing to a shared long-lived socket rather than creating one, the shape is the same — the cleanup removes only the listener:

```jsx
useEffect(() => {
  const unsubscribe = client.subscribe(channel, handleMessage)
  return unsubscribe
}, [channel])
```

Have your subscribe function return its own unsubscriber. It keeps the two halves next to each other and makes them hard to get out of sync.

## Fixing the deps that caused it

Cleanup alone stops the leak, but re-subscribing on every render is still wasteful. Narrow the dependencies to primitives:

```jsx
// causes a resubscribe every render
useEffect(() => { ... }, [config])

// stable
useEffect(() => { ... }, [config.url, config.channel])
```

If a callback must be in the deps, wrap it in `useCallback` at the definition site, or — better for this case — hold the latest handler in a ref so the effect does not depend on it at all:

```jsx
const handlerRef = useRef(onMessage)
useEffect(() => { handlerRef.current = onMessage })

useEffect(() => {
  const socket = new WebSocket(url)
  socket.addEventListener("message", (e) => handlerRef.current(e))
  return () => socket.close()
}, [url])
```

That pattern keeps the connection alive across renders while still calling the newest handler.

## Confirming it is really this

Open DevTools and watch the **Network → WS** panel. One connection that stays at one is healthy. A list that grows as you interact with the page is your bug, and the count usually maps directly to how many times the effect re-ran.

A heap snapshot taken twice, minutes apart, with a filter on your handler's name, gives the same answer from the other direction: retained closures climbing with no ceiling.

## Two related leaks in the same shape

Anything with a matching open/close pair belongs in this pattern, and forgetting the close produces the same curve:

- `setInterval` without `clearInterval`
- `addEventListener` on `window` or `document` without `removeEventListener`
- `IntersectionObserver` / `ResizeObserver` without `disconnect()`
- an in-flight `fetch` that resolves after unmount and calls `setState` — abort it with an `AbortController` in the cleanup

The habit worth building: the moment you write a line that opens something inside an effect, write the cleanup line before you write anything else.
