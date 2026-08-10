---
kind: eval-artifact
run: 6
variant: P
replicate: r3
task: T4
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

You are stacking websocket subscriptions. The effect re-runs, subscribes again, and never unsubscribes the old one, so after an hour hundreds of listeners all handle the same message.

## The shape of the bug

```jsx
useEffect(() => {
  const socket = new WebSocket(url)
  socket.onmessage = (e) => setMessages((m) => [...m, JSON.parse(e.data)])
})
```

Two problems here, and either one alone is enough.

**No cleanup.** The effect opens a socket and never closes it. Every re-run leaves the previous socket open and listening.

**No dependency array.** Without one, the effect runs after *every* render. Each message updates state, which renders, which runs the effect, which opens another socket, which delivers the next message N times. That is a feedback loop, and it is why the slowdown accelerates instead of staying flat.

Your symptom matches: slow growth at first, then worse, and worse still the more traffic the socket carries.

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

- **The cleanup function.** React calls it before re-running the effect, and again on unmount. Closing the socket there is what stops the pile-up.
- **The dependency array.** `[url]` re-runs the effect only when the URL changes, not on every render.
- **A named handler.** Cleanup needs it to remove the exact listener it added. Assigning `socket.onmessage` also works for a socket you own outright, since closing it discards the handler, but the explicit add/remove pair is the habit worth having.

## If it is still slow after that

Check these in order.

**Unstable dependencies.** If your array holds an object, array, or function defined in the component body, it is a new reference every render, so the effect re-runs every render anyway.

```jsx
const options = { room: roomId }          // new object each render
useEffect(() => { ... }, [options])       // re-runs constantly
```

Depend on the primitive instead — `[roomId]` — or wrap the object in `useMemo`.

**Unbounded message state.** If you append every message to an array and render all of them, the array grows without limit and every render re-processes the whole list. That gives you the same "slower the longer it is open" symptom even with perfect cleanup. Cap the buffer:

```jsx
setMessages((m) => [...m, next].slice(-500))
```

Or virtualize the list so only visible rows render.

**A shared socket without reference counting.** If the socket lives in a context or a module singleton and several components subscribe, each needs its own add/remove pair. Closing the shared socket in one component's cleanup breaks the others.

**Reconnect logic that stacks too.** A reconnect timer set inside `onclose` with no matching `clearTimeout` in cleanup piles up exactly the way sockets do.

## How to confirm it before you ship

Open DevTools, Network tab, filter to WS. Leave the page running a minute. One socket is right. A growing list confirms the diagnosis.

For listener growth on a shared socket, take two heap snapshots in the Memory tab a few minutes apart and compare retained closures. A count climbing in step with time is the tell.

## The rule underneath

Every effect that starts something must return the function that stops it — subscriptions, timers, sockets, observers, event listeners, animation frames, abort controllers. If the effect body has a verb like *open*, *add*, *set*, or *observe*, the cleanup needs the matching *close*, *remove*, *clear*, or *disconnect*. React Strict Mode mounts, unmounts, and remounts every component in development to surface exactly this. Doubled behavior in dev is the warning, not a bug in React.
