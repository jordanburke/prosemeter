---
kind: eval-artifact
run: 5
variant: L
replicate: r5
task: T4
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your effect opens a websocket subscription and never closes it. Every re-run stacks another live subscription on top of the last, so message handling work doubles, then triples, and the page crawls. Return a cleanup function from the effect.

## What is happening

`useEffect` runs after render. It runs again whenever a value in the dependency array changes, and again after every render if you left the array off.

Each run calls `subscribe`. Nothing calls `unsubscribe`. So after ten re-runs you have ten open subscriptions, all listening, all firing your handler for the same message.

That produces the exact symptom you describe. The page is fine at first and degrades with time, because the subscription count only grows. Each incoming message now triggers ten state updates instead of one, each update triggers a render, and each render may re-run the effect and add an eleventh.

You are probably also seeing "cannot update state on an unmounted component" warnings, or duplicate messages in your list. Those are the same bug from other angles.

## The fix

Return a cleanup function. React calls it before the next run of the effect and once more on unmount.

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

Now each run tears down what the last one built. The count stays at one.

## Get the dependency array right

The cleanup only helps if the effect re-runs for a real reason. Two mistakes are common.

**A missing array.** `useEffect(fn)` with no second argument runs after every single render. That is the fastest path to the pile-up you have.

**An unstable dependency.** An object or function defined in the component body is a new value every render, so a dependency array containing it never matches. Move the value outside the component, wrap it in `useMemo`/`useCallback`, or depend on the primitive inside it:

```jsx
}, [config])        // new object each render — effect re-runs forever
}, [config.url])    // a string — stable across renders
```

Turn on `eslint-plugin-react-hooks`. The `exhaustive-deps` rule catches both.

## Do not reconnect on every state change

A websocket is expensive to open. If your handler writes to state and that state is in the deps, you reconnect on every message.

Keep the socket out of the render cycle. Put the mutable handler in a ref, and let the effect depend only on the connection identity:

```jsx
const handlerRef = useRef(handleMessage)
useEffect(() => { handlerRef.current = handleMessage })

useEffect(() => {
  const socket = new WebSocket(url)
  socket.addEventListener("message", (e) => handlerRef.current(e))
  return () => socket.close()
}, [url])
```

The socket now opens once per `url` and the handler stays current.

## About Strict Mode

In development, React 18 and later mount, unmount, and remount every component once. Your effect runs twice on purpose. That is a leak detector, not a bug — with correct cleanup you end at one subscription. If two subscriptions survive, you have found the problem you are chasing.

## How to confirm it

Open DevTools, go to the Network tab, filter to WS, and watch the connection list while you use the page. One connection is right. A growing list is the leak.
