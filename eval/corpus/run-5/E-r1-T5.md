---
kind: eval-artifact
run: 5
variant: E
replicate: r1
task: T5
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work, and it will cost you something. `useCallback` alone does not stop a child re-rendering. The child re-renders when its parent re-renders, whatever the props look like — unless the child is wrapped in `React.memo`. Without that wrapper, every `useCallback` in your codebase is pure overhead.

## Why the prop identity does not matter by itself

React's default is simple: when a component re-renders, it re-renders all its children. It does not compare props first. Prop comparison is opt-in behavior that `React.memo` adds.

So this changes nothing:

```jsx
const handleClick = useCallback(() => doThing(id), [id])
return <Child onClick={handleClick} />
```

`Child` re-renders every time the parent does. The stable function reference has no one asking about it.

This works:

```jsx
const Child = React.memo(function Child({ onClick }) { ... })
```

Now `React.memo` shallow-compares props, sees the same function reference, and skips the render. `useCallback` and `React.memo` are two halves of one mechanism. Either alone does nothing.

## What it costs

`useCallback` is not free. Every call allocates the dependency array, stores it, and compares it against the previous one on each render. You also still create the inner function on every render — `useCallback` decides which one to *keep*, it does not skip the creation.

The bigger cost is human. A `useCallback` on every prop makes the dependency arrays part of your maintenance surface. Miss a dependency and you get a stale closure — a handler reading last render's state, which is a genuinely hard bug to see. The lint rule catches many cases, not all.

## When it is actually worth it

Reach for the pair when one of these is true:

- **The child is memoized and its render is expensive.** A large list, a chart, a heavy tree. Measure the render cost before you assume it.
- **The function is a dependency of another hook.** A `useEffect` that depends on a callback will re-run whenever that callback's identity changes. Here `useCallback` prevents a re-subscribe or a refetch, and the benefit is real regardless of memo.
- **You are passing it through a context value.** Every context consumer re-renders when the value's identity changes, so an unstable function in the value invalidates the whole subtree.

## What usually helps more

Most "too many re-renders" problems are structural, not identity problems. Try these first:

**Move state down.** If only one subtree reads a piece of state, put the state in that subtree. The parent stops re-rendering entirely and the question disappears.

**Pass children as a prop.** A component that re-renders does not re-render elements it received as `children`, because those were created by the parent above.

```jsx
<ExpensiveWrapper>
  <StaticThing />
</ExpensiveWrapper>
```

**Split the component.** One component holding fast-changing state and slow-rendering markup will always be slow. Two components will not.

## A note on the React Compiler

React 19's compiler memoizes automatically, including callback identity. If you are on it, hand-written `useCallback` is mostly redundant. That is another reason not to spread it across the codebase by policy — you may be writing code you delete in a year.

## What to tell them

Profile first. Open the React DevTools Profiler, record an interaction, and look at which components actually take time. Then memoize those, with `React.memo` and `useCallback` together. Blanket `useCallback` adds noise, adds stale-closure risk, and fixes nothing on its own.
