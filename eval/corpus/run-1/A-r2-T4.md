---
kind: eval-artifact
run: 1
variant: A
replicate: r2
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
"Gets slower the longer it's open" plus "useEffect that subscribes" is close to a signature. You're almost certainly leaking subscriptions — every time that effect re-runs it opens a new websocket connection (or adds a new listener) and never tears down the old one. After twenty re-renders you have twenty live sockets, twenty handlers firing on every message, and twenty setState calls per event. The degradation is linear in effect re-runs, which is why it feels like the page is "wearing out."

**Two things to check, and it's usually both**

**1. Is there a cleanup function?**

```jsx
// leaks
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = (e) => setMessages((m) => [...m, JSON.parse(e.data)])
}, [url])

// correct
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = (e) => setMessages((m) => [...m, JSON.parse(e.data)])
  return () => ws.close()      // <- runs before every re-run AND on unmount
}, [url])
```

The returned function runs before the effect fires again and on unmount. Without it, nothing ever closes.

If you're using `addEventListener` rather than assigning `onmessage`, note that the cleanup has to remove *the same function reference* — `removeEventListener` with a freshly-defined inline arrow is a silent no-op and leaks exactly the same way.

**2. Is the dependency array causing needless re-runs?**

Even with cleanup, an effect that tears down and rebuilds a websocket on every render is a performance problem in its own right (and a correctness one — you'll drop messages during the gap). The usual cause is a non-primitive dep that's re-created each render:

```jsx
}, [options])          // object literal defined in the component body — new identity every render
}, [onMessage])        // inline callback — same problem
}, [user])             // fine only if `user` is referentially stable
```

Depend on primitives (`user.id`, `url`) rather than objects. For a callback that must stay current without re-subscribing, park it in a ref:

```jsx
const handlerRef = useRef(onMessage)
useLayoutEffect(() => { handlerRef.current = onMessage })

useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = (e) => handlerRef.current(JSON.parse(e.data))
  return () => ws.close()
}, [url])              // only re-subscribes when the URL actually changes
```

**How to confirm it's this before you change anything**

- Chrome DevTools → **Network → WS** tab. Leave the page open, poke around, and watch the connection count. If it climbs and old ones stay green, that's your answer.
- Or `console.log` in both the effect body and the cleanup. Subscribe logs outnumbering unsubscribe logs = leak.
- Memory tab → take a heap snapshot, interact, take another, compare retained size. Growing detached listeners confirm it.

**A couple of adjacent suspects worth ruling out while you're in there**

- **Unbounded state.** `setMessages(m => [...m, msg])` grows forever. Thousands of items in an unvirtualized list will tank render time on its own, no leak required. Cap the array or virtualize the list.
- **Cleanup that doesn't cover the in-flight case.** If the socket is still in `CONNECTING` when cleanup runs, `close()` handles it fine, but any `setState` from a race'd async handler afterward is wasted work — guard with a `cancelled` flag if you have async work in the effect.
- **StrictMode in dev** double-invokes effects deliberately, precisely to surface missing cleanup. If it's noticeably worse in dev than prod, that's the mechanism, and it's telling you the truth about a real bug.

Post the effect and I'll tell you which one it is.
