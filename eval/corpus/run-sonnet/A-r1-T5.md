---
kind: eval-artifact
run: sonnet
variant: A
replicate: r1
task: T5
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Wrapping the function in `useCallback` alone won't stop the child re-rendering — it only stabilizes the function's reference. Something on the child side still has to act on that stable reference.

Two things have to be true together:
1. The prop is referentially stable (`useCallback` gives you this).
2. The child component is memoized (`React.memo`), so it actually skips rendering when its props are unchanged.

Without #2, React re-renders the child on every parent render regardless of whether the callback prop changed — `useCallback` doesn't stop a render on its own, it just avoids handing the child a *new* function each time, which only matters if something is checking for that.

Other things worth flagging before they do this:
- Other props passed alongside the callback need to be stable too — a fresh object/array literal on any other prop defeats `React.memo`'s shallow comparison even if the callback is fine.
- `useCallback`'s own dependency array matters — if it lists something that changes every render, the reference isn't actually stable and this buys nothing.
- It's worth asking whether the re-renders are actually a measurable problem first. Wrapping every prop function has its own cost (extra memory, extra comparison), and if the child is cheap to render, this is complexity with no payoff.

So: tell them to add `React.memo` to the child, keep the `useCallback` deps tight, and check for other unstable props — and to confirm there's a real perf problem before doing all this.
