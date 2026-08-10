---
kind: eval-artifact
run: 6
variant: P
replicate: r5
task: T4
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Your effect subscribes more than once and never unsubscribes. Each re-run attaches another websocket handler, the old ones stay, and one incoming message fires two handlers, then three, then twenty. That is the slowdown, and it grows with time on the page.

## Why the effect re-runs

`useEffect` re-runs when any value in its dependency array changes between renders, compared with `Object.is`. Two causes account for most cases.

An object or function sits in the deps array and gets rebuilt each render. `{ url }` is a new object every time, never equal to the last one, so the effect runs on every render.

Or the deps array is missing. `useEffect(fn)` with no second argument runs after every render, and a subscription there leaks by construction.

Worth knowing: in development, StrictMode runs an effect, cleans it up, and runs it again on mount. That is deliberate, and it exists to surface exactly this bug.

## The fix: return a cleanup function

An effect can return a function. React calls it before the next run and again on unmount. Whatever the effect opened, the cleanup closes.

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

Each run now has one socket, torn down before the next opens. `url` is a string, so the comparison is stable.

Subscribing to a shared long-lived socket takes the same shape, with the cleanup removing only the listener:

```jsx
useEffect(() => {
  const unsubscribe = client.subscribe(channel, handleMessage)
  return unsubscribe
}, [channel])
```

Have your subscribe function return its own unsubscriber. That keeps both halves together and makes them hard to desynchronize.

## Fix the deps that caused it

Cleanup stops the leak, but resubscribing on every render still wastes work. Narrow the dependencies to primitives:

```jsx
// resubscribes every render
useEffect(() => { ... }, [config])

// stable
useEffect(() => { ... }, [config.url, config.channel])
```

If a callback must appear in the deps, wrap it in `useCallback` where it is defined. Better here, hold the latest handler in a ref so the effect never depends on it:

```jsx
const handlerRef = useRef(onMessage)
useEffect(() => { handlerRef.current = onMessage })

useEffect(() => {
  const socket = new WebSocket(url)
  socket.addEventListener("message", (e) => handlerRef.current(e))
  return () => socket.close()
}, [url])
```

That keeps the connection alive across renders and still calls the newest handler.

## Confirm it is really this

Open DevTools and watch **Network → WS**. One connection that stays at one is healthy. A list that grows as you use the page is your bug, and the count usually matches how many times the effect re-ran.

Two heap snapshots minutes apart, filtered on your handler's name, answer from the other direction: retained closures climbing with no ceiling.

## Two leaks of the same shape

Anything with a matching open and close belongs in this pattern, and skipping the close draws the same curve:

- `setInterval` without `clearInterval`
- `addEventListener` on `window` or `document` without `removeEventListener`
- `IntersectionObserver` or `ResizeObserver` without `disconnect()`
- an in-flight `fetch` that resolves after unmount and calls `setState` — abort it with an `AbortController` in the cleanup

Build this habit: the moment you write a line that opens something inside an effect, write the cleanup line next.
