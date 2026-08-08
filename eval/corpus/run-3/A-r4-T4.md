---
kind: eval-artifact
run: 3
variant: A
replicate: r4
task: T4
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Almost certainly your effect is subscribing repeatedly without unsubscribing, so you're accumulating live subscriptions over the life of the page. Every message then gets handled N times, N grows, and the page degrades steadily. That "slower the longer it's open" shape is the tell — a genuinely slow render is slow immediately.

Two things to check, and it's often both.

**1. Is there a cleanup function?**

```jsx
// leaking
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = handleMessage
}, [url])

// fixed
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = handleMessage
  return () => ws.close()   // <- this
}, [url])
```

Whatever the effect opens, the returned function has to close. Same for `addEventListener` → `removeEventListener`, `setInterval` → `clearInterval`, and any subscribe API that hands you back an unsubscribe.

**2. What's in the dependency array?**

This is the part that bites people who *did* write cleanup. If a dep changes identity on every render, the effect tears down and re-runs constantly. With no cleanup, that's a new subscription per render — which is how you get hundreds of them. Common culprits:

```jsx
useEffect(() => { ... }, [options])           // object literal, new every render
useEffect(() => { ... }, [onMessage])         // inline function prop
useEffect(() => { ... })                      // no array at all — runs every render
```

Fix by making the dep stable: `useMemo` the object, `useCallback` the handler, or better, depend on the primitive you actually care about (`[userId]` rather than `[user]`).

**How to confirm before you change anything.** Open DevTools → Network → WS. If you see the connection count climbing as you sit on the page, that's it, done. Alternatively log in the effect body and in the cleanup and watch whether they pair up 1:1. If setup fires ten times and cleanup fires zero, you have your answer.

**A couple of related causes if that isn't it:**

- Handler appends to state without bound — `setMessages(prev => [...prev, msg])` on a chat feed will get slow after a few thousand messages purely from rendering the list. Cap the array or virtualize.
- Handler closes over stale state and you "fixed" it by removing the dep array. That reintroduces the resubscribe loop. The right fix is the updater form (`setX(prev => ...)`) or a ref.

One note on React 18 StrictMode in dev: effects intentionally mount, unmount, and remount so leaks like this surface immediately. If you're seeing doubled connections only in dev and cleanup is correct, that's expected and won't happen in production. If they keep climbing past two, it's a real leak.
