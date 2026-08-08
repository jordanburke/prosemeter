---
kind: eval-artifact
run: 5
variant: F
replicate: r4
task: T4
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
## What is likely wrong?

Your effect subscribes to the websocket but never unsubscribes, so subscriptions pile up. Every time the effect reruns, it adds another handler and leaves the old one in place. After ten reruns, one incoming message fires ten handlers, each of which sets state, each of which triggers a render. The page gets slower in proportion to how long it has been open, which matches exactly what you are seeing.

This is a leak. The old handlers still hold references to old props and old state, so the garbage collector cannot free them either. Memory grows alongside the slowdown.

The tell is the shape of the code:

```jsx
useEffect(() => {
  socket.on("message", handleMessage)
}, [roomId])
```

There is no return, so nothing tears down the old handler when `roomId` changes.

## Why does the effect rerun at all?

React reruns an effect when any value in its dependency array changes between renders. Two things commonly make that happen more than you expect.

**A missing dependency array.** Write `useEffect(fn)` with no second argument and it runs after *every* render. That is the fastest version of this bug.

**A dependency that is a new object each render.** React compares dependencies by reference, not by contents. An inline object, array, or function is a fresh reference on every render, so the effect reruns every render even though nothing meaningful changed.

```jsx
// options is a new object each render, so this effect reruns constantly
useEffect(() => {
  socket.on("message", handler)
}, [options])
```

## How do I fix it?

Return a cleanup function from the effect. React runs it before the next rerun of that effect, and once more when the component unmounts.

```jsx
useEffect(() => {
  const handleMessage = (msg) => setMessages((prev) => [...prev, msg])
  socket.on("message", handleMessage)
  return () => socket.off("message", handleMessage)
}, [roomId])
```

Two details make the cleanup actually work.

**Remove the same function reference you added.** `socket.off("message", handleMessage)` only works because `handleMessage` names the identical function that was passed to `on`. Defining the handler inside the effect guarantees this. Calling `socket.off("message")` with no handler is a blunter fix — it removes everyone's handler for that event, including another component's.

**Own the connection too, if the effect opened it.** If the effect calls `new WebSocket(url)`, the cleanup must call `socket.close()`. Leaving sockets open leaks a network connection on top of the handler.

## How do I confirm this is the problem?

Count the handlers as the page runs. Log `socket.listenerCount("message")` inside the effect, or print a line in both the subscribe and the cleanup and watch whether they stay balanced.

If the counts climb, you have found it. If they stay at one and the page still degrades, look next at unbounded state — an array of messages that grows forever will slow rendering on its own, and the fix there is to cap the list or virtualize it.

## One thing that will confuse you in development

React's StrictMode deliberately mounts, unmounts, and remounts each component once in development. You will see the subscribe run twice. That is the check working, not a bug: correct cleanup makes the double-mount harmless. If double-mounting breaks your code, the cleanup is still wrong.
