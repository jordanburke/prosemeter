---
kind: eval-artifact
run: 4
variant: A
replicate: r1
task: T4
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Almost certainly a leaking subscription — the effect is opening a new websocket connection (or registering a new handler) on some re-renders, and never tearing down the old one. They pile up. Every message then gets handled N times, N grows the longer the page is open, and both memory and CPU climb steadily. "Gets slower the longer it's open" is the signature.

Two things to check.

**1. Is there a cleanup function?** If the effect looks like this, that's the bug:

```tsx
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = (e) => setMessages((m) => [...m, JSON.parse(e.data)])
}, [url])
```

There's no return, so when `url` changes or the component unmounts, React has no way to close the old socket. Fix:

```tsx
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = (e) => setMessages((m) => [...m, JSON.parse(e.data)])
  return () => ws.close()
}, [url])
```

**2. Is the dependency array stable?** This is the sneakier version, and it bites even when you *do* have cleanup. If a dep is a value recreated on every render — an inline object, an array, a function defined in the component body — then it's a new reference every time, the effect tears down and re-subscribes on every single render, and you get connection churn that looks like a leak from the outside.

```tsx
// options is a fresh object every render -> effect re-runs every render
useEffect(() => { ... }, [options])
```

Fix by depending on primitives, or memoizing the object with `useMemo`, or moving it outside the component if it's actually constant.

Quick way to confirm which one you're looking at: open DevTools, Network tab, filter to WS. If you see one connection that never closes, deps are fine and you're missing cleanup somewhere else. If you see connections accumulating, or opening and closing rapidly, you've found it.

Also worth verifying that your message handler isn't the real growth. `setMessages(m => [...m, msg])` on a chatty socket grows an array forever and re-renders the whole list each time. That alone will degrade a page over hours even with a perfectly correct subscription. Cap the buffer or virtualize the list.

One note on React 18+: in dev with StrictMode, effects intentionally run twice — mount, unmount, mount. That's not a bug, it's React checking that your cleanup is correct. If your app misbehaves under it, the cleanup is genuinely wrong. Don't disable StrictMode to make the symptom go away.

If this pattern shows up in more than one place, it's worth pulling the socket out of component lifecycle entirely — one connection held in a module or context, components subscribe to it via `useSyncExternalStore`. That's what that hook exists for, and it makes the subscribe/unsubscribe pairing much harder to get wrong.
