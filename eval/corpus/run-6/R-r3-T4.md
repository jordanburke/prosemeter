---
kind: eval-artifact
run: 6
variant: R
replicate: r3
task: T4
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

You are stacking websocket subscriptions. The effect re-runs and subscribes again. It never unsubscribes the old one, so after an hour hundreds of listeners all handle the same message.

## The shape of the bug

```jsx
useEffect(() => {
  const socket = new WebSocket(url)
  socket.onmessage = (e) => setMessages((m) => [...m, JSON.parse(e.data)])
})
```

Two problems here, and either one alone is enough.

**No cleanup.** The effect opens a socket and never closes it. Every re-run leaves the previous socket open and listening.

**No dependency array.** Without one, the effect runs after *every* render. Each new message triggers a state update. The update triggers a render. The render runs the effect, which opens another socket, which delivers the next message N times. That feedback loop is why the slowdown accelerates instead of staying flat.

The symptom matches: slow growth at first, then worse, and worse still the more traffic the socket carries.

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

Three changes:

- **The cleanup function.** React calls it before re-running the effect, and again when the component unmounts. Closing the socket there stops the accumulation.
- **The dependency array.** `[url]` re-runs the effect only when the URL changes, not on every render.
- **A named handler.** Cleanup needs it to remove the exact listener it added. Assigning `socket.onmessage` also works for a socket you own outright, since closing that socket discards the handler. The explicit pair is still the habit worth having.

## If the slowdown continues after that

Check these in order.

**Unstable dependencies.** An object, array, or function defined in the component body is a new reference on every render. Put one in your dependency array and the effect re-runs every render regardless.

```jsx
const options = { room: roomId }          // new object each render
useEffect(() => { ... }, [options])       // re-runs constantly
```

Depend on the primitive instead — `[roomId]` — or wrap the object in `useMemo`.

**Unbounded message state.** Append every message to an array and render them all, and the array grows without limit while every render re-processes the whole list. That produces the same "slower the longer it is open" symptom even with perfect cleanup. Cap the buffer:

```jsx
setMessages((m) => [...m, next].slice(-500))
```

Or virtualize the list so only the visible rows render.

**A shared socket without reference counting.** When the socket lives in a context or a module singleton and four components subscribe, each one needs its own add/remove pair. Closing the shared socket in one component's cleanup breaks the others.

**Reconnect logic that also stacks.** A reconnect timer set inside `onclose` with no matching `clearTimeout` in cleanup accumulates the way sockets do.

## How to confirm it before you ship

Open DevTools, go to the Network tab, filter to WS. Leave the page running for a minute. One socket is right. A growing list confirms the diagnosis.

For listener growth on a shared socket, take two heap snapshots in the Memory tab five minutes apart and compare retained closures. A count climbing in step with time is the tell.

## The rule underneath

Every effect that starts a thing must return the function that stops it. That covers subscriptions, timers, sockets, observers, event listeners, animation frames, and abort controllers. If the effect body has a verb like *open*, *add*, *set*, or *watch*, the cleanup needs the matching *close*, *remove*, *clear*, or *disconnect*. React Strict Mode in development mounts, unmounts, and remounts every component on purpose to surface exactly this. Doubled behavior in dev is the warning, not a bug in React.
