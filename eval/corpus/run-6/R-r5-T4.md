---
kind: eval-artifact
run: 6
variant: R
replicate: r5
task: T4
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Your effect subscribes more than once and never unsubscribes. Every re-run opens another websocket handler, and the old ones stay attached. Each incoming message then fires two handlers, then three, then twenty. That is the slowdown, and it compounds the longer the page stays open.

## Why the effect re-runs

`useEffect` re-runs when a value in its dependency array changes between renders. React compares those values with `Object.is`. Two mistakes cause the re-run without anyone intending it.

The first: an object or function sits in the deps array and gets recreated each render. `{ url }` is a new object every time. It never equals the previous one, so the effect runs on every render.

The second: the deps array is missing. `useEffect(fn)` with no second argument runs after every render, and a subscription there leaks by construction.

One more thing to know. In development, React's StrictMode runs an effect, cleans it up, and runs it again on mount. That is deliberate. It exists to surface this exact bug.

## The fix: return a cleanup function

An effect can return a function. React calls that function before the next run and again on unmount. Whatever the effect opened, the cleanup closes.

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

Each run now has one socket. React tears it down before the next one opens. Note that `url` is a string, so the comparison stays stable.

Maybe you subscribe to a shared long-lived socket instead of creating one. The shape holds, and the cleanup removes only the listener:

```jsx
useEffect(() => {
  const unsubscribe = client.subscribe(channel, handleMessage)
  return unsubscribe
}, [channel])
```

Have your subscribe function return its own unsubscriber. That keeps the two halves next to each other, and they are hard to get out of sync.

## Fixing the deps that caused it

Cleanup stops the leak. Re-subscribing on every render is still wasteful. Narrow the dependencies to primitives:

```jsx
// causes a resubscribe every render
useEffect(() => { ... }, [config])

// stable
useEffect(() => { ... }, [config.url, config.channel])
```

If a callback must appear in the deps, wrap it in `useCallback` at the definition site. For a websocket, hold the latest handler in a ref so the effect does not depend on it at all:

```jsx
const handlerRef = useRef(onMessage)
useEffect(() => { handlerRef.current = onMessage })

useEffect(() => {
  const socket = new WebSocket(url)
  socket.addEventListener("message", (e) => handlerRef.current(e))
  return () => socket.close()
}, [url])
```

That pattern keeps the connection alive across renders and still calls the newest handler.

## Confirming the diagnosis

Open DevTools and watch the **Network → WS** panel. One connection that stays at one is healthy. A list that grows as you interact with the page is your bug. The count maps to how many times the effect re-ran.

Take a heap snapshot twice, minutes apart, filtered on your handler's name. It gives the same answer from the other direction: retained closures climbing with no ceiling.

## Two related leaks in the same shape

Anything with a matching open/close pair belongs in this pattern. Forget the close and you get the same curve:

- `setInterval` without `clearInterval`
- `addEventListener` on `window` or `document` without `removeEventListener`
- `IntersectionObserver` / `ResizeObserver` without `disconnect()`
- an in-flight `fetch` that resolves after unmount and calls `setState` — abort it with an `AbortController` in the cleanup

The habit worth building: the moment you write a line that opens a resource inside an effect, write the cleanup line next.
