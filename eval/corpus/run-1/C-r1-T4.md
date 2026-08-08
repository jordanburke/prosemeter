---
kind: eval-artifact
run: 1
variant: C
replicate: r1
task: T4
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You're leaking sockets. The effect opens a new one each time it runs, and the old one never closes.

Two things to check.

**Does the effect return a cleanup function?** If not, that's your bug:

```ts
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = handleMessage
  return () => ws.close() // <- this line
}, [url])
```

**Does a dep change on every render?** Then the effect tears down and re-runs on every render, which churns sockets even with cleanup. The usual culprit is an inline object, array, or arrow function:

```ts
}, [{ room: roomId }])  // new object each render — reruns forever
}, [roomId])            // a string, stable
```

A handler passed down from a parent hits the same trap. Wrap it in `useCallback`, or park it in a ref and read `ref.current` inside `onmessage`. Then it stays out of the deps.

To confirm in about a minute: open DevTools, Network tab, filter to WS, and let the page sit. If the count of open sockets climbs, you found it.

Each live socket pins its closure — your state, your component, everything they touch. So memory climbs, and every message fans out to N handlers instead of one. The longer the tab stays open, the worse both get.

One more thing: turn on StrictMode in dev. React mounts effects twice there on purpose, so a missing cleanup screams at you locally instead of in prod.
