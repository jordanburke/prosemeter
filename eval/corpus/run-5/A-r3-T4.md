---
kind: eval-artifact
run: 5
variant: A
replicate: r3
task: T4
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You are almost certainly stacking websocket subscriptions. The effect re-runs, subscribes again, and never unsubscribes the old one — so after an hour you have hundreds of listeners all handling the same message.

## The shape of the bug

```jsx
useEffect(() => {
  const socket = new WebSocket(url)
  socket.onmessage = (e) => setMessages((m) => [...m, JSON.parse(e.data)])
})
```

Two problems, and either one alone is enough.

**No cleanup.** The effect opens a socket and never closes it. Every re-run leaves the previous socket open and listening.

**No dependency array.** Without one, the effect runs after *every* render. Each new message causes a state update, which causes a render, which runs the effect, which opens another socket, which delivers the next message N times. That is a feedback loop, and it is why the slowdown accelerates rather than staying flat.

The symptom matches: slow growth at first, then worse, and worse the more traffic the socket carries.

## The fix

```jsx
useEffect(() => {
  const socket = new WebSocket(url)

  const handleMessage = (e) => {
    setMessages((m) => [...m, JSON.parse(e.data)])
  }

  socket.addEventListener("message", handleMessage)

  return () => {
    socket.removeEventListener("message", handleMessage)
    socket.close()
  }
}, [url])
```

Three things changed:

- **The cleanup function.** React calls it before re-running the effect and again when the component unmounts. Closing the socket there is what stops the accumulation.
- **The dependency array.** `[url]` means the effect re-runs only when the URL changes, not on every render.
- **A named handler.** Needed so cleanup can remove the exact listener it added. Assigning `socket.onmessage` also works for a socket you own outright, since closing it discards the handler anyway, but the explicit pair is the habit worth having.

## If the slowdown continues after that

Check these in order.

**Unstable dependencies.** If your array holds an object, array, or function defined in the component body, it is a new reference on every render, so the effect re-runs every render regardless.

```jsx
const options = { room: roomId }          // new object each render
useEffect(() => { ... }, [options])       // re-runs constantly
```

Depend on the primitive instead — `[roomId]` — or wrap the object in `useMemo`.

**Unbounded message state.** If you append every message to an array and render all of them, the array grows without limit and every render re-processes the whole list. That produces the same "slower the longer it is open" symptom even with perfect cleanup. Cap the buffer:

```jsx
setMessages((m) => [...m, next].slice(-500))
```

Or virtualize the list so only the visible rows render.

**A shared socket without reference counting.** If the socket lives in a context or module singleton and several components subscribe to it, each needs its own add/remove pair. Closing the shared socket in one component's cleanup breaks the others.

**Reconnect logic that also stacks.** A reconnect timer set inside `onclose` without a matching `clearTimeout` in cleanup accumulates the same way sockets do.

## How to confirm it before you ship

Open DevTools, Network tab, filter to WS. Leave the page running for a minute. One socket is right. A growing list confirms the diagnosis.

For listener growth on a shared socket, take two heap snapshots in the Memory tab a few minutes apart and compare retained closures — the count climbing in step with time is the tell.

## The rule underneath

Every effect that starts something must return the function that stops it. Subscriptions, timers, sockets, observers, event listeners, animation frames, abort controllers. If the effect body has a verb like *open*, *add*, *set*, or *observe*, the cleanup needs the matching *close*, *remove*, *clear*, or *disconnect*. React Strict Mode in development deliberately mounts, unmounts, and remounts every component to surface exactly this — if you are seeing doubled behavior in dev, that is the warning, not a bug in React.
