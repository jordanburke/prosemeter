---
kind: eval-artifact
run: 2
variant: Ep
replicate: r3
task: T5
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It won't, on its own. `useCallback` keeps the function identity stable across renders, but a stable prop only prevents a re-render if the child is wrapped in `React.memo`. A plain child re-renders whenever its parent does, no matter how stable its props are.

So the pair is the unit: `React.memo` on the child, `useCallback` on the handler. Skip either half and you get nothing.

And `memo` compares *all* props shallowly. One inline object or array — `style={{ margin: 8 }}`, `items={data.filter(...)}` — is a fresh reference every render and blows the comparison, so the stable callback next to it buys you zero.

The cost of doing it everywhere is real. Each `useCallback` allocates a closure and a deps array on every render, then runs a comparison. For a cheap child, you've added work to save work that was already cheap. Wrapping every prop makes the code noisier and the app marginally slower.

Worse, the deps arrays become a maintenance surface. A stale dep in a `useCallback` gives you a handler closing over old state, and that's a real bug — harder to find than the re-render it was meant to avoid.

Where it does pay: a child that's genuinely expensive to render, like a large list, a chart, or a tree. Also anywhere the function is a dependency of a `useEffect`, where an unstable identity re-runs the effect every render — that one matters even with no `memo` in sight.

Suggest measuring first. Open the React DevTools Profiler, record the slow interaction, and look at which components actually take time. Memoize those. If nothing shows up, the re-renders aren't the problem — React re-rendering a small component tree is fast, and people usually optimize renders when the real cost is elsewhere.
