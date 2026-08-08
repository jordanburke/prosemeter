---
kind: eval-artifact
run: 4
variant: Et
replicate: r1
task: T5
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Mostly it will not, and it costs you something either way. `useCallback` only helps when the child is wrapped in `React.memo`, and even then only when every other prop is stable too.

**Why**

An unmemoized child re-renders when its parent re-renders. Full stop. It does not compare props. Giving it a stable function changes nothing — the parent rendered, so the child renders.

`React.memo` is what makes the child compare props. `useCallback` is what makes the function prop pass that comparison. You need both, and you need them together. One without the other is dead weight.

**And the other props still have to be stable**

```tsx
<Child onSave={stableCallback} config={{ mode: "edit" }} />
```

That object literal is new every render. `React.memo` bails, the child re-renders, and your `useCallback` bought nothing. Same for inline arrays, inline JSX passed as a prop, and anything derived without `useMemo`.

**What it costs**

`useCallback` is not free. It allocates a dependency array, compares it every render, and holds the old function alive. Applied to every prop, you add real overhead to every render in exchange for savings that mostly do not materialize. You also add a dependency array to every callback — and a wrong one gives you a stale closure, which is a real bug rather than a slow render.

**When it is worth doing**

Reach for it when a specific child is measurably expensive: a big list, a chart, a heavy table, or a component whose render triggers a network call. Then memo that child, stabilize *all* its props, and confirm with the Profiler that the re-render actually stopped.

**A better first move**

If re-rendering is genuinely your problem, look at what is causing the parent to render so often. State that lives too high up re-renders the whole tree on every keystroke. Pushing state down, or splitting the component, usually beats memoizing anything.

**Note if you are on React 19**

The React Compiler does this automatically and does it better than hand-placed hooks. If you can turn it on, do that instead of the blanket refactor.

Measure first. Profiler, record an interaction, look at what actually renders and what it costs. Then memoize the two or three components that show up.
