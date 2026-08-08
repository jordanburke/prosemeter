---
kind: eval-artifact
run: 3
variant: E
replicate: r5
task: T4
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You are leaking subscriptions. The effect opens a new websocket listener on every run and never closes the old one, so listeners pile up and each message fires all of them.

The usual shape looks like this:

```tsx
useEffect(() => {
  socket.on("message", handleMessage)
}, [handleMessage])
```

Two problems stack up. The effect returns no cleanup, so nothing removes the old listener. And `handleMessage` is a new function on every render, so the dependency changes constantly and the effect re-runs constantly. After an hour of open tab you have thousands of live handlers, each one calling `setState`, each one holding a closure over a stale render's variables. The page crawls, and memory climbs.

Return a cleanup function:

```tsx
useEffect(() => {
  const handleMessage = (msg: Message) => {
    setMessages((prev) => [...prev, msg])
  }
  socket.on("message", handleMessage)
  return () => {
    socket.off("message", handleMessage)
  }
}, [socket])
```

Three things changed. The handler now lives inside the effect, so it is not a dependency. The cleanup removes exactly the listener it added. The dependency array holds only `socket`, which is stable, so the effect runs once.

Note the `setMessages((prev) => ...)` form. Using the updater function means the handler never has to read `messages` from its closure, which is what would otherwise force you to re-subscribe on every message.

Confirm the diagnosis before and after. Open DevTools, take a heap snapshot, wait five minutes, take another, and compare retained size. You can also log inside the effect body — if it prints more than once at startup, the effect is churning.

If you own the socket connection too, tear it down in the same cleanup. And watch React 18 StrictMode in development: it mounts, unmounts, and remounts effects on purpose to surface exactly this bug. If your code breaks under StrictMode, the cleanup is wrong.
