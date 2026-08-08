---
kind: eval-artifact
run: 1
variant: D
replicate: r2
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You're almost certainly leaking subscriptions. The effect runs more than once, each run opens a new subscription, and nothing ever tears the old ones down — so after an hour on the page you have dozens of live handlers, all firing on every message.

The symptom profile matches exactly: fine at first, degrades continuously, gets worse the longer it's open, and never recovers without a refresh. It's linear growth in work-per-message. Twenty subscriptions means every inbound message triggers twenty setState calls, twenty re-renders, twenty of whatever else that handler does. And none of the old closures can be garbage collected, so memory climbs too.

Two things cause it, usually together.

**1. No cleanup function.** `useEffect` lets you return a function that React calls before the next run and on unmount. If you don't return one, the subscription just outlives the effect.

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

Note it's `removeEventListener` *and* `close`. If you're using a shared socket you don't own, remove the listener but don't close it — otherwise you kill it for everyone else.

**2. The dependency array is unstable, so the effect re-runs constantly.** This is the more common root cause and it hides well. React compares deps by reference (`Object.is`), so if you pass an object, array, or function created during render, it's a brand-new reference every render and the effect re-runs *every single render*:

```jsx
useEffect(() => { ... }, [{ roomId }])           // new object every render
useEffect(() => { ... }, [options])              // if options is built inline, same problem
useEffect(() => { ... }, [onMessage])            // inline arrow prop, same problem
```

Also check whether the effect depends on state it also *sets* — subscribe, message arrives, `setMessages([...messages, m])`, `messages` changed, effect re-runs, resubscribe. That's a self-sustaining loop that also happens to look like a memory leak.

**How to fix it properly:**

- Give the effect a cleanup return. Non-negotiable, even if the deps look stable today.
- Reduce deps to primitives — `[roomId]`, `[url]`, not `[config]`. If you need an object, `useMemo` it, or destructure the two fields you actually use.
- For state updates inside the handler, use the functional form: `setMessages(prev => [...prev, m])`. Now the effect doesn't need `messages` in its deps at all, which kills the resubscribe loop.
- For a callback prop that changes identity every render, stash it in a ref and read `ref.current` inside the handler. The handler stays stable, the effect stops churning:
  ```jsx
  const cbRef = useRef(onMessage)
  useEffect(() => { cbRef.current = onMessage })   // no dep array, runs every render, cheap
  ```
- Consider whether the socket belongs in a component at all. One connection in a provider/context, components subscribe to a topic — that way mounting and unmounting UI doesn't churn the actual TCP connection.

**How to confirm before you change anything:** put a `console.log("subscribe")` at the top of the effect and `console.log("unsubscribe")` in the cleanup. Use the page for a minute. If subscribes outnumber unsubscribes, that's your bug and you'll see it in ten seconds. Chrome DevTools also has a WebSocket count under Network, and a heap snapshot taken two minutes apart will show the retained closures piling up.

One caveat worth knowing: in dev with StrictMode, React 18+ deliberately mounts, unmounts, and remounts every component once, so you'll see subscribe/unsubscribe/subscribe on load. That's intentional — it's React proving your cleanup works. Don't "fix" it by removing StrictMode; it's the thing that would have caught this.
