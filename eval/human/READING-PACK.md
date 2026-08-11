# Ten pairs, blind

Ten questions. For each, two answers by different writers. **Which one better serves the person who asked?**

Better means the reader understands the answer and can act on it. Do not reward length in either direction — a longer answer is not more thorough and a shorter one is not clearer.

Ties are allowed and are a real answer. If two answers are genuinely equivalent, say tie rather than picking one.

Record ten lines in this format and nothing else:

```
pair 1: better=<A|B|tie> | why=<one sentence>
...
```

Roughly 14,000 words in total. The pairs are independent, so stopping partway is fine — whatever is answered can be analysed.

---

## Pair 1

**The question that was asked:**

> A React developer's page gets slower the longer it is open. They have a useEffect that subscribes to a websocket. Explain what is likely wrong and how to fix it.

### Answer A

The effect is almost certainly re-running and opening a new subscription each time without closing the old one. Every re-run leaves a live listener behind, so the count grows the longer the page stays open.

## Why it shows up as gradual slowness

Each stale subscription still holds its handler, and each handler still fires. After twenty re-runs, one incoming message triggers twenty callbacks, twenty state updates, and twenty renders. The page does not break. It just does more work per message, forever.

Those handlers also capture their surrounding scope, so old component state, old props, and anything the closures reference stay reachable. The garbage collector cannot reclaim them. Memory climbs alongside the CPU cost.

That is the signature: fine at first, sluggish after a few minutes, unbearable after an hour.

## The two ways it usually happens

**No cleanup function.** The effect opens the socket and returns nothing.

```jsx
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = (e) => setMessages((m) => [...m, JSON.parse(e.data)])
}, [url])
```

**Unstable dependencies.** There is a cleanup, but the dependency array holds a value rebuilt on every render, so the effect tears down and reconnects constantly.

```jsx
useEffect(() => { /* ... */ }, [options])   // options = {} rebuilt every render
```

The second is sneakier, because the code looks right. React compares dependencies with `Object.is`, and a fresh object literal never equals the previous one. So the effect runs every render — and if the effect also sets state, it reconnects as fast as the browser allows.

## The fix

Return a cleanup function. React calls it before the next run and on unmount.

```jsx
useEffect(() => {
  const ws = new WebSocket(url)

  const handleMessage = (e) => {
    setMessages((m) => [...m, JSON.parse(e.data)])
  }

  ws.addEventListener("message", handleMessage)

  return () => {
    ws.removeEventListener("message", handleMessage)
    ws.close()
  }
}, [url])
```

The effect now owns exactly one socket at a time. `url` changes, the old socket closes and a new one opens. The component unmounts, the socket closes.

Note the updater form, `setMessages((m) => ...)` rather than `setMessages([...messages, x])`. The second reads `messages` from the closure, which forces you to list it as a dependency, which reconnects the socket on every message. The updater form reads nothing from the closure, so no state has to go in the array.

## Fixing the dependency side

Get non-primitive values out of the array, or make them stable.

- Inline the object inside the effect if only the effect uses it.
- Depend on the primitive fields — `[options.roomId, options.token]` — rather than the object.
- Wrap a function dependency in `useCallback`, and a computed object in `useMemo`, where they are created.

Turn on `react-hooks/exhaustive-deps` in ESLint if it is off. It catches the missing-dependency half of this bug class. It cannot catch the unstable-dependency half, so you still have to look.

## Confirm the diagnosis before you fix it

Do not guess. Two checks take a minute each.

Log both directions and watch the console:

```jsx
useEffect(() => {
  console.log("connecting")
  const ws = new WebSocket(url)
  return () => { console.log("closing"); ws.close() }
}, [url])
```

If "connecting" prints repeatedly with no matching "closing", you have your answer.

Or open DevTools, go to the Network tab, and filter to WS. Every open websocket is a row. One row is correct. A growing list is the leak, visible directly.

For the memory side, take two heap snapshots a few minutes apart and compare retained objects. Growing counts of the same component or closure confirm nothing is being released.

## One thing that is not the bug

In development with StrictMode on, React deliberately mounts, unmounts, and remounts every component once, so you see two connections at startup. That is React checking your cleanup works, and it does not happen in production builds. If the count stops at two, you are fine. If it keeps climbing, you are not.

## Extracting it

Once it works, move it into a hook so the next feature gets the cleanup for free.

```jsx
function useWebSocket(url, onMessage) {
  const handlerRef = useRef(onMessage)
  useEffect(() => { handlerRef.current = onMessage })

  useEffect(() => {
    const ws = new WebSocket(url)
    const listener = (e) => handlerRef.current(e)
    ws.addEventListener("message", listener)
    return () => {
      ws.removeEventListener("message", listener)
      ws.close()
    }
  }, [url])
}
```

The ref keeps the latest callback reachable without putting it in the dependency array, so a caller passing an inline arrow function does not reconnect the socket on every render.

If the app has several sockets, or needs reconnect-with-backoff, reach for a library rather than growing this one. But fix the cleanup first. That is the whole bug.

### Answer B

The effect re-runs and opens a new subscription each time. It never closes the old one. Every re-run leaves a live listener behind, so the count grows the longer the page stays open.

## Why this shows up as gradual slowness

Each stale subscription still holds its socket handler, and each handler still fires. After twenty re-runs, one incoming message triggers twenty callbacks, twenty state updates, and twenty renders. The page does not break. It does more work per message, forever.

The handlers also capture their surrounding scope. The old component state, the old props, and any data those closures reference all stay reachable. The garbage collector cannot reclaim them. Memory climbs alongside the CPU cost.

That is the signature: fine at first, sluggish after five minutes, unbearable after an hour.

## The two ways it happens

**No cleanup function.** The effect opens the socket and returns nothing.

```jsx
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = (e) => setMessages((m) => [...m, JSON.parse(e.data)])
}, [url])
```

**Unstable dependencies.** A cleanup exists, but the dependency array holds a value that is a new object or function on every render. The effect tears down and rebuilds constantly.

```jsx
useEffect(() => { /* ... */ }, [options])   // options = {} rebuilt every render
```

The second is sneakier, because the code reads as correct. React compares dependencies with `Object.is`. A fresh object literal never equals the previous one, so the effect runs every render. If the effect also sets state, you have a loop that reconnects as fast as the browser allows.

## The fix

Return a cleanup function. React calls it before the next run and on unmount.

```jsx
useEffect(() => {
  const ws = new WebSocket(url)

  const handleMessage = (e) => {
    setMessages((m) => [...m, JSON.parse(e.data)])
  }

  ws.addEventListener("message", handleMessage)

  return () => {
    ws.removeEventListener("message", handleMessage)
    ws.close()
  }
}, [url])
```

Now the effect owns exactly one socket at a time. `url` changes, the old socket closes, a new one opens. The component unmounts, the socket closes.

Note the state updater form — `setMessages((m) => ...)` instead of `setMessages([...messages, x])`. The second reads `messages` from the closure. That forces you to list it as a dependency, which reconnects the socket on every message. The updater form reads nothing from the closure and keeps state out of the dependency array.

## Fixing the dependency side

Get non-primitive dependencies out of the array, or make them stable.

- Inline the object inside the effect if only the effect uses it.
- Depend on the primitive fields — `[options.roomId, options.token]` — not the object.
- Wrap a function dependency in `useCallback`, and a computed object in `useMemo`, where they are created.

Turn on `react-hooks/exhaustive-deps` in ESLint if you have it off. It catches the missing-dependency half of this bug class. It cannot catch the unstable-dependency half, so you still have to look.

## Confirming the diagnosis before you fix it

Check, do not assume. Two checks take a minute each.

Log in both directions and watch the console:

```jsx
useEffect(() => {
  console.log("connecting")
  const ws = new WebSocket(url)
  return () => { console.log("closing"); ws.close() }
}, [url])
```

If "connecting" prints repeatedly with no matching "closing", you have your answer.

Or open DevTools, go to the Network tab, and filter to WS. Every open websocket shows as a row. One row is correct. A growing list is the leak, visible directly.

For the memory side, take two heap snapshots five minutes apart and compare retained objects. Growing counts of the same component or closure confirm that nothing is released.

## One thing that is not the bug

In development with StrictMode on, React deliberately mounts, unmounts, and remounts every component once. You will see two connections at startup. That is React checking your cleanup, not a leak, and it does not happen in production builds. If the count stays at two and stops, you are fine. If it keeps climbing, you are not.

## Extracting it

Once it works, move it into a hook so the next feature gets the cleanup for free.

```jsx
function useWebSocket(url, onMessage) {
  const handlerRef = useRef(onMessage)
  useEffect(() => { handlerRef.current = onMessage })

  useEffect(() => {
    const ws = new WebSocket(url)
    const listener = (e) => handlerRef.current(e)
    ws.addEventListener("message", listener)
    return () => {
      ws.removeEventListener("message", listener)
      ws.close()
    }
  }, [url])
}
```

The ref keeps the latest callback reachable without putting it in the dependency array. A caller passing an inline arrow function no longer reconnects the socket on every render.

If the app opens three or more sockets, or needs reconnect-with-backoff, reach for a library instead of growing this. Fix the cleanup first. That is the whole bug.

---

## Pair 2

**The question that was asked:**

> A junior engineer asks why adding an index to a database table made their writes slower, when everyone told them indexes make things faster. Explain.

### Answer A

Indexes speed up reads and slow down writes. Both halves are true. Nobody told you the second one.

## Why the write got slower

An index is a second copy of some of your data, kept sorted. When you insert a row, the database writes the row to the table, then writes an entry into every index on that table. Five indexes mean six writes, not one.

Updates cost more than they look. If you update a column an index covers, the database cannot edit the entry in place, because the entry's position depends on its value. It deletes the old entry and inserts a new one where the new value sorts. Deletes touch every index too.

So the rough rule is: one index, one extra write per row change.

## The part that is not just "more writes"

Four things make the slowdown bigger than the count suggests.

**Page splits.** B-tree indexes store entries in fixed-size pages. When a page fills and a new entry belongs in the middle, the database splits the page in two and rewrites both. Index a random-ish value — a UUID, an email address — and inserts land all over the tree, so splits happen constantly. Index an always-increasing value like an auto-increment id, and new entries land at the right edge where splits are cheap. That is why a UUID primary key can cost several times what a sequential one costs at the same insert rate.

**Random I/O.** The table rows you insert are sequential. The index pages you must update are scattered. If the index does not fit in memory, each insert becomes a disk seek. An index that fits in RAM and one that does not differ by orders of magnitude, not percentages.

**Locking.** Concurrent writers touching the same index pages contend on them. On a hot index over a timestamp, every insert goes to the same right-edge page, so all your writers queue on it. That shows up as latency rising with load, not with data size.

**Log amplification.** The index change also goes to the write-ahead log, so it hits durable storage twice.

## Whether the trade is worth it

Usually yes. A query that scans 10 million rows and one that seeks an index differ by a factor of thousands. Adding a millisecond to writes to remove a second from reads is a good deal in almost every application, because most applications read far more than they write.

It stops being a good deal when:

- **The index is not used.** Check first. Every database reports index usage — `pg_stat_user_indexes` in Postgres, `sys.dm_db_index_usage_stats` in SQL Server. An unused index is pure cost.
- **The index duplicates another.** An index on `(a)` is redundant if you already have `(a, b)`, because the composite serves prefix lookups too. Drop the narrower one.
- **The table is write-heavy and the read it serves is rare** — a nightly report, an admin screen.
- **You added several at once.** Six indexes for six queries is often three indexes reorganized.

## What to do now

Measure before you decide. Find out how much slower, on which operation, and whether the query you added it for actually got faster.

```sql
EXPLAIN (ANALYZE, BUFFERS) INSERT ...;
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;   -- the query you added it for
```

Then pick:

- **The read win is real and the write cost is tolerable** — keep it. This is the common outcome.
- **The index is on a random value and the table is huge** — ask whether the lookup could go on a sequential column instead, or whether the table wants a different physical layout.
- **The write path is latency-critical** (checkout, ingestion) — move the read to a replica and index there, not on the primary.
- **A bulk load is the slow part** — drop the index before the load and rebuild after. Building once is far cheaper than maintaining it row by row.

## The rule to carry forward

Indexes are neither free nor automatic. Each one is a bet that the reads it speeds up outweigh the writes it taxes. Add them one at a time, for a query you have measured, then check that the query got faster and the writes did not get worse than you can live with.

### Answer B

Indexes speed up reads. They slow down writes. Both are true at once, and nobody told you the second half.

## Why the write got slower

An index is a second copy of one or more columns, kept sorted. Insert a row, and the database writes the row to the table, then writes an entry into every index on that table. Five indexes means six writes.

Updates cost more than they look. Update a column that an index covers, and the database cannot edit the index entry in place. The entry's position depends on its value. So it deletes the old entry and inserts a new one at the new sorted position. Deletes touch every index too.

The arithmetic is simple: one index, one extra write per row change. That is the part everyone forgets.

## The part that is more than "more writes"

Four mechanisms make the slowdown bigger than the count implies.

**Page splits.** B-tree indexes store entries in fixed-size pages. When a page fills and a new entry belongs in the middle, the database splits the page in two and rewrites both. Index a random value — a UUID, an email address — and inserts land all over the tree, so splits happen constantly. Index an always-increasing value like an auto-increment id, and new entries land at the right edge, where splits are cheap. This is why a UUID primary key can cost five times what a sequential one costs at the same insert rate.

**Random I/O.** The table rows you insert are sequential. The index pages you must update are scattered. If the index does not fit in memory, each insert turns into a disk seek. An index that fits in RAM and one that does not differ by a factor of hundreds, not by percentages.

**Locking.** Concurrent writers touching the same index pages contend on them. On a hot index over a timestamp, every insert goes to the same right-edge page, so all your writers queue on one page. That shows up as latency rising with load, not with data size.

**Write amplification in the log.** The index change also goes to the write-ahead log, so it hits durable storage twice.

## Whether the trade is worth it

It normally is. A query that scans 10 million rows and one that seeks an index differ by a factor of thousands. Adding a millisecond to writes to remove a second from reads is a good deal for any application that reads more than it writes, which covers nearly all of them.

It stops being a good deal when:

- The index goes unused. Check first — every database reports index usage, and an unused index is pure cost. Use `pg_stat_user_indexes` in Postgres, `sys.dm_db_index_usage_stats` in SQL Server.
- The index duplicates another. An index on `(a)` is redundant when you already have `(a, b)`, because the composite serves prefix lookups. Drop the narrower one.
- The table is write-heavy and the read it serves runs once a night — a report, an admin screen.
- You added six at once. Six indexes for six queries is three indexes reorganized.

## What to do now

Measure before you decide. Find out how much slower, on which operation, and whether the query you added the index for got faster.

```sql
EXPLAIN (ANALYZE, BUFFERS) INSERT ...;
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;   -- the query you added it for
```

Then pick:

- **The read win is real and the write cost is tolerable** — keep it. This is the common outcome.
- **The index covers a random value on a table of 100 million rows** — look at whether the lookup can go on a sequential column, or whether the table wants a different physical layout.
- **The write path is latency-critical** (checkout, ingestion) — move the read to a replica and index there, not on the primary.
- **A bulk load has to pass through the index** — drop it before the load and rebuild after. Building once costs far less than maintaining it row by row.

## The rule to carry forward

Indexes are neither free nor automatic. Each one is a bet that the reads it accelerates outweigh the writes it taxes. Add them one at a time, for a query you have measured. Check afterwards that the query got faster and that the writes stayed inside what you can live with.

---

## Pair 3

**The question that was asked:**

> A teammate asks why their build broke after another team added a package. Two packages now depend on different versions of the same library. Explain what is happening and how to fix it.

### Answer A

Two packages ask for different versions of the same library. The package manager found no single version that satisfies both. What happens next depends on the manager and on where the conflict sits.

## Why the build broke

Three failure shapes are common. Each looks different in the error output.

**Two copies got installed.** npm, pnpm, and yarn resolve this by nesting. Package A gets `lib@1`, package B gets `lib@2`, and both live in the tree at once. The install succeeds. The build then breaks, because your code was written for one copy. Classic symptoms: `instanceof` returns false, one singleton becomes two, React throws "invalid hook call", a class registers twice. TypeScript reports two identical types that are not assignable to each other.

**One copy got hoisted, and it is the wrong one.** The ranges overlap, so the manager picks a single version. One package now runs against a version it was not written for. You get `TypeError: x.y is not a function`, or a missing export.

**The install itself failed.** npm 7+ and pnpm enforce peer dependencies. If the new package declares `peerDependencies: { lib: "^2" }` and you are on `lib@1`, the install errors out instead of guessing.

## How to see which one you have

Ask the package manager to print the tree for that library.

```
npm ls <library>
pnpm why <library>
yarn why <library>
```

The output shows every version present. It also shows which package pulled each one in. That tells you how many copies you have, and which dependency holds the old range.

## How to fix it

Work down this list. Stop at the first option that applies.

**Upgrade the package that is behind.** The older constraint may come from a dependency that has since released a version supporting `lib@2`. Bump it. This is the real fix, and the only one that leaves no residue.

**Change your own direct dependency.** If your `package.json` pins the version that conflicts, move it to the range both packages accept.

**Force a single version.** Every manager has an override mechanism:

```jsonc
// npm
"overrides": { "lib": "2.3.0" }

// pnpm
"pnpm": { "overrides": { "lib": "2.3.0" } }

// yarn
"resolutions": { "lib": "2.3.0" }
```

This collapses the tree to one copy. It is a real fix when the two ranges work together in practice and the version bound is conservative. It is a lie to the resolver when they do not. Then it converts an install error into a runtime error. Use it only after you check that the package with the older range runs against the newer library.

**Make the library a peer dependency.** Some libraries must be a singleton — React, a state store, a database driver holding a connection pool. Packages that use one should declare it as a peer dependency, not a regular one. That pushes the choice up to the application. It also makes the constraint visible at install time instead of at runtime. If one of those packages is yours, fix it there.

## Preventing the next one

Two copies of a stateless utility library is a bundle-size problem. Two copies of a library that holds state is a correctness problem. It will surface as a bug that makes no sense. If you depend on libraries in the second category, add a check to CI. `npm ls <library>` exiting non-zero is enough. A duplicate then fails the build at once, not three weeks later.

### Answer B

Two packages in your tree ask for different versions of the same library, and the package manager could not pick one version that satisfies both. What breaks next depends on how the manager reacted.

## Why the build broke

Three failure shapes cover almost every case, and each looks different in the error output.

**Two copies got installed.** npm, pnpm, and yarn usually resolve a conflict by nesting: package A gets `lib@1`, package B gets `lib@2`, and both sit in the tree. The install succeeds. The build breaks because your code assumes one copy. The tells are `instanceof` returning false, a singleton that is now two singletons, React's "invalid hook call", duplicate class registration, or TypeScript refusing to assign two structurally identical types to each other.

**One copy got hoisted, and it is the wrong one.** When the two ranges overlap enough to pick a single version, one package runs against a version it was not written for. You get `TypeError: x.y is not a function`, or a missing export.

**The install itself failed.** npm 7+ and pnpm enforce peer dependencies. If the new package declares `peerDependencies: { lib: "^2" }` and you are on `lib@1`, the install errors instead of guessing.

## Find out which one you have

Ask the manager to print the tree for that library.

```
npm ls <library>
pnpm why <library>
yarn why <library>
```

The output lists every version present and the package that pulled each one in. That tells you whether you have one copy or several, and which dependency holds the old range.

## How to fix it

Work down this list. Stop at the first option that applies.

**Upgrade the package that is behind.** If the older constraint comes from a dependency that has since shipped support for `lib@2`, bump it. This is the real fix, and the only one that leaves no residue.

**Move your own direct dependency.** If your `package.json` pins the version that conflicts, change it to a range both packages accept.

**Force a single version.** Every manager has an override:

```jsonc
// npm
"overrides": { "lib": "2.3.0" }

// pnpm
"pnpm": { "overrides": { "lib": "2.3.0" } }

// yarn
"resolutions": { "lib": "2.3.0" }
```

This collapses the tree to one copy. It is a real fix when the two ranges are compatible in practice and the lower bound was just conservative. It is a lie to the resolver when they are not, and it turns an install error into a runtime error. Use it only after checking that the package with the older range works against the newer library.

**Make the library a peer dependency.** If the library must be a singleton — React, a state store, a driver holding a connection pool — the packages that use it should declare it as a peer rather than a regular dependency. That pushes the choice up to the application and surfaces the constraint at install time instead of at runtime. If one of those packages is yours, fix it there.

## Preventing the next one

Two copies of a stateless utility cost you bundle size. Two copies of a library that holds state cost you correctness, and the bug will make no sense when it lands. For libraries in that second group, add a CI check — `npm ls <library>` exiting non-zero is enough — so a duplicate fails the build the day it appears rather than three weeks later.

---

## Pair 4

**The question that was asked:**

> A teammate says they are going to wrap every function they pass as a prop in useCallback, to stop child components re-rendering. Explain whether that will work.

### Answer A

It will not work, and it will leave the code slower and harder to read. `useCallback` on its own stops no child from re-rendering. It removes one of several reasons a child re-renders, and if the other reasons remain it removes nothing.

## Why a stable function is not enough

React re-renders a child whenever the parent re-renders. It does not compare props first. That comparison happens only when the child is wrapped in `React.memo`.

The chain has two links:

```jsx
const Child = React.memo(function Child({ onClick }) { ... })

const handleClick = useCallback(() => { ... }, [])
```

`React.memo` lets the child skip a render when its props are shallowly equal. `useCallback` keeps the function prop equal across renders so that check can pass. Without `memo`, the stable function changes nothing: the child re-renders anyway, and you paid for memoization with no return.

That is the core answer. `useCallback` without `React.memo` on the receiving component is dead code.

## The second thing that breaks it

Even with `memo` in place, every prop must be stable, not just the callbacks. One inline object undoes the arrangement:

```jsx
<Child onClick={handleClick} style={{ margin: 8 }} items={items.filter(Boolean)} />
```

`style` is a fresh object each render. `items` is a fresh array. The shallow comparison fails on those, the child re-renders, and the `useCallback` did nothing. Wrapping every function while leaving the objects inline is the most common way this effort produces no measurable change.

Children count as a prop too. `<Child>{something}</Child>` passes a new element object each render, which defeats `memo` the same way.

## What it costs

`useCallback` is not free. It allocates the dependency array, stores the function on the fiber, and runs a comparison every render. For a callback that is cheap to recreate — nearly all of them — you add work to save nothing. The saving appears only when the child's render is expensive enough to outweigh that overhead.

The larger cost is correctness risk. Every `useCallback` carries a dependency array, and every dependency array is a place to capture a stale value. Applying it across a codebase multiplies the arrays a reviewer must verify, and a stale-closure bug is much harder to find than a redundant render.

Readability costs too. A file where every handler is wrapped reads as if all of them are performance-critical, which hides the two that are.

## When it earns its place

Four cases justify it:

- The prop goes to a `React.memo` child whose render is genuinely expensive — a large list, a chart, a heavy table row.
- The function is a dependency of a `useEffect`. An unstable function there tears down and re-runs the effect every render, which can mean resubscribing to a socket on every keystroke. Here instability is a bug, not a performance detail.
- The function goes to a custom hook that treats it as a dependency, for the same reason.
- The value goes into a context provider, where an unstable value re-renders every consumer.

## What to do instead

Fix re-renders structurally first. That usually beats memoization outright.

**Move state down.** If the state driving the re-render sits in a component that renders an expensive subtree, push the state into a smaller component that owns it. Nothing above it re-renders.

**Pass expensive subtrees as children.** A re-rendering component does not re-render elements it received as props, so `<Layout>{<ExpensiveThing />}</Layout>` leaves `ExpensiveThing` untouched when `Layout`'s state changes. You get the win with no `memo` and no `useCallback` anywhere.

**Measure before optimizing.** The React DevTools Profiler shows which components re-render, how long each takes, and why each render happened. Turn it on, run the interaction that feels slow, and look. Most re-renders cost microseconds and are not worth removing.

**Consider the compiler.** The React Compiler memoizes automatically and correctly, which makes hand-written `useCallback` largely obsolete. If adopting it is on the table, that beats a manual sweep.

## Summary

Tell your teammate the sweep will not reach the goal. `useCallback` without `React.memo` prevents nothing, and `React.memo` fails anyway when any other prop is recreated inline. Profile first, memoize the few components where it measurably helps, and reach for `useCallback` unconditionally only where an unstable function causes a real bug — effect dependencies and context values.

### Answer B

It will not work. It will also make the code slower and harder to read. `useCallback` alone does not stop a child re-rendering. It removes one reason out of many, and the other reasons stay.

## Why a stable function is not enough

React re-renders a child every time the parent re-renders. It does not compare props first. That comparison happens only when the child is wrapped in `React.memo`.

So the chain has two links:

```jsx
const Child = React.memo(function Child({ onClick }) { ... })

const handleClick = useCallback(() => { ... }, [])
```

`React.memo` makes the child skip re-rendering when its props are shallowly equal. `useCallback` keeps the function prop equal across renders, so that check can pass. Without `memo`, the stable function changes nothing. The child re-renders anyway, and you paid for memoization with no return.

That is the core answer. `useCallback` without `React.memo` on the receiving component is dead code.

## The second thing that breaks it

Even with `memo` in place, every prop must be stable — not the callbacks alone. One inline object undoes the whole arrangement:

```jsx
<Child onClick={handleClick} style={{ margin: 8 }} items={items.filter(Boolean)} />
```

`style` is a fresh object every render. `items` is a fresh array. The shallow comparison fails on those. The child re-renders, and the `useCallback` did nothing. Wrapping every function while leaving the objects inline is the most common way this effort produces no measurable change.

Children are a prop too. `<Child>{content}</Child>` passes a new element object each render, which defeats `memo` the same way.

## What it costs

`useCallback` is not free. It allocates the dependency array, stores the function on the fiber, and runs a comparison on every render. Nearly every callback is cheap to recreate. For those, you add work and save nothing. The saving appears only when the child's render costs more than that overhead.

The bigger cost is correctness risk. Every `useCallback` has a dependency array, and every dependency array can capture a stale value. Apply it mechanically across a codebase and you multiply the arrays a reviewer must verify. Stale-closure bugs are far harder to find than a redundant render.

Readability is a real cost too. A file where every handler is wrapped reads as if all of them are performance-critical. That hides the two that are.

## When it does earn its place

Four cases justify it:

- The prop goes to a `React.memo` child whose render is expensive — a large list, a chart, a heavy table row.
- The function is a dependency of a `useEffect`. An unstable function there tears down and re-runs the effect every render. That can mean resubscribing to a socket on every keystroke. Here instability is a bug, not a performance detail.
- The function is passed to a custom hook that treats it as a dependency, for the same reason.
- The value goes into a context provider, where an unstable value re-renders every consumer.

## What to do instead

Fix re-renders at the structural level first. Structure beats memoization outright.

Move state down. If the state driving the re-render lives in a component that renders an expensive subtree, push the state into a smaller component that owns it. Nothing above it re-renders.

Pass expensive subtrees as children. A re-rendering component does not re-render elements it received as props. `<Layout>{<ExpensiveThing />}</Layout>` leaves `ExpensiveThing` untouched when `Layout`'s state changes. You get the win with no `memo` and no `useCallback` anywhere.

Measure before optimizing. The React DevTools Profiler shows which components re-render and how long each takes, with a "why did this render" reason per commit. Turn it on, do the interaction that feels slow, and look. Re-renders that cost microseconds are not worth removing, and that describes most of them.

Look at the compiler. The React Compiler memoizes automatically and correctly, which makes hand-written `useCallback` obsolete in most files. If adopting it is on the table, spend the effort there instead of on a sweep.

## Summary

Tell your teammate the sweep will not reach the goal. `useCallback` without `React.memo` prevents nothing, and `React.memo` fails when any other prop is recreated inline. Profile first. Apply memoization to the components where it measurably helps. Reach for `useCallback` unconditionally only where an unstable function causes a real bug — effect dependencies and context values.

---

## Pair 5

**The question that was asked:**

> A React developer's page gets slower the longer it is open. They have a useEffect that subscribes to a websocket. Explain what is likely wrong and how to fix it.

### Answer A

You are stacking websocket subscriptions. The effect re-runs and subscribes again. It never unsubscribes the old one, so after an hour hundreds of listeners all handle the same message.

## The shape of the bug

```jsx
useEffect(() => {
  const socket = new WebSocket(url)
  socket.onmessage = (e) => setMessages((m) => [...m, JSON.parse(e.data)])
})
```

Two problems here, and either one alone is enough.

**No cleanup.** The effect opens a socket and never closes it. Every re-run leaves the previous socket open and listening.

**No dependency array.** Without one, the effect runs after *every* render. Each new message triggers a state update. The update triggers a render. The render runs the effect, which opens another socket, which delivers the next message N times. That feedback loop is why the slowdown accelerates instead of staying flat.

The symptom matches: slow growth at first, then worse, and worse still the more traffic the socket carries.

## The fix

```jsx
useEffect(() => {
  const socket = new WebSocket(url)

  const handleMessage = (e) => {
    setMessages((m) => [...m, JSON.parse(e.data)])
  }

  socket.addEventListener("message", handleMessage)

  return () => {
    socket.removeEventListener("message", handleMessage)
    socket.close()
  }
}, [url])
```

Three changes:

- **The cleanup function.** React calls it before re-running the effect, and again when the component unmounts. Closing the socket there stops the accumulation.
- **The dependency array.** `[url]` re-runs the effect only when the URL changes, not on every render.
- **A named handler.** Cleanup needs it to remove the exact listener it added. Assigning `socket.onmessage` also works for a socket you own outright, since closing that socket discards the handler. The explicit pair is still the habit worth having.

## If the slowdown continues after that

Check these in order.

**Unstable dependencies.** An object, array, or function defined in the component body is a new reference on every render. Put one in your dependency array and the effect re-runs every render regardless.

```jsx
const options = { room: roomId }          // new object each render
useEffect(() => { ... }, [options])       // re-runs constantly
```

Depend on the primitive instead — `[roomId]` — or wrap the object in `useMemo`.

**Unbounded message state.** Append every message to an array and render them all, and the array grows without limit while every render re-processes the whole list. That produces the same "slower the longer it is open" symptom even with perfect cleanup. Cap the buffer:

```jsx
setMessages((m) => [...m, next].slice(-500))
```

Or virtualize the list so only the visible rows render.

**A shared socket without reference counting.** When the socket lives in a context or a module singleton and four components subscribe, each one needs its own add/remove pair. Closing the shared socket in one component's cleanup breaks the others.

**Reconnect logic that also stacks.** A reconnect timer set inside `onclose` with no matching `clearTimeout` in cleanup accumulates the way sockets do.

## How to confirm it before you ship

Open DevTools, go to the Network tab, filter to WS. Leave the page running for a minute. One socket is right. A growing list confirms the diagnosis.

For listener growth on a shared socket, take two heap snapshots in the Memory tab five minutes apart and compare retained closures. A count climbing in step with time is the tell.

## The rule underneath

Every effect that starts a thing must return the function that stops it. That covers subscriptions, timers, sockets, observers, event listeners, animation frames, and abort controllers. If the effect body has a verb like *open*, *add*, *set*, or *watch*, the cleanup needs the matching *close*, *remove*, *clear*, or *disconnect*. React Strict Mode in development mounts, unmounts, and remounts every component on purpose to surface exactly this. Doubled behavior in dev is the warning, not a bug in React.

### Answer B

You are stacking websocket subscriptions. The effect re-runs, subscribes again, and never unsubscribes the old one, so after an hour hundreds of listeners all handle the same message.

## The shape of the bug

```jsx
useEffect(() => {
  const socket = new WebSocket(url)
  socket.onmessage = (e) => setMessages((m) => [...m, JSON.parse(e.data)])
})
```

Two problems here, and either one alone is enough.

**No cleanup.** The effect opens a socket and never closes it. Every re-run leaves the previous socket open and listening.

**No dependency array.** Without one, the effect runs after *every* render. Each message updates state, which renders, which runs the effect, which opens another socket, which delivers the next message N times. That is a feedback loop, and it is why the slowdown accelerates instead of staying flat.

Your symptom matches: slow growth at first, then worse, and worse still the more traffic the socket carries.

## The fix

```jsx
useEffect(() => {
  const socket = new WebSocket(url)

  const handleMessage = (e) => {
    setMessages((m) => [...m, JSON.parse(e.data)])
  }

  socket.addEventListener("message", handleMessage)

  return () => {
    socket.removeEventListener("message", handleMessage)
    socket.close()
  }
}, [url])
```

Three things changed:

- **The cleanup function.** React calls it before re-running the effect, and again on unmount. Closing the socket there is what stops the pile-up.
- **The dependency array.** `[url]` re-runs the effect only when the URL changes, not on every render.
- **A named handler.** Cleanup needs it to remove the exact listener it added. Assigning `socket.onmessage` also works for a socket you own outright, since closing it discards the handler, but the explicit add/remove pair is the habit worth having.

## If it is still slow after that

Check these in order.

**Unstable dependencies.** If your array holds an object, array, or function defined in the component body, it is a new reference every render, so the effect re-runs every render anyway.

```jsx
const options = { room: roomId }          // new object each render
useEffect(() => { ... }, [options])       // re-runs constantly
```

Depend on the primitive instead — `[roomId]` — or wrap the object in `useMemo`.

**Unbounded message state.** If you append every message to an array and render all of them, the array grows without limit and every render re-processes the whole list. That gives you the same "slower the longer it is open" symptom even with perfect cleanup. Cap the buffer:

```jsx
setMessages((m) => [...m, next].slice(-500))
```

Or virtualize the list so only visible rows render.

**A shared socket without reference counting.** If the socket lives in a context or a module singleton and several components subscribe, each needs its own add/remove pair. Closing the shared socket in one component's cleanup breaks the others.

**Reconnect logic that stacks too.** A reconnect timer set inside `onclose` with no matching `clearTimeout` in cleanup piles up exactly the way sockets do.

## How to confirm it before you ship

Open DevTools, Network tab, filter to WS. Leave the page running a minute. One socket is right. A growing list confirms the diagnosis.

For listener growth on a shared socket, take two heap snapshots in the Memory tab a few minutes apart and compare retained closures. A count climbing in step with time is the tell.

## The rule underneath

Every effect that starts something must return the function that stops it — subscriptions, timers, sockets, observers, event listeners, animation frames, abort controllers. If the effect body has a verb like *open*, *add*, *set*, or *observe*, the cleanup needs the matching *close*, *remove*, *clear*, or *disconnect*. React Strict Mode mounts, unmounts, and remounts every component in development to surface exactly this. Doubled behavior in dev is the warning, not a bug in React.

---

## Pair 6

**The question that was asked:**

> A teammate wants to cache the response of every GET endpoint in a shared CDN cache to speed the app up. Explain whether that will work.

### Answer A

It will speed the app up. It will also serve one user's private data to another. "Every GET endpoint" is the wrong part, not the caching.

## Why GET is not the right test

`GET` means the request has no side effects. It does not mean the response is the same for everyone. A shared CDN cache stores one copy per cache key — normally the URL — and hands that copy to the next requester in line.

So `GET /api/me` gets fetched once, by whichever user arrives first. Then the CDN hands that response to every later user until it expires. The same goes for `/api/cart`, `/api/notifications`, and `/api/orders`. This is not hypothetical: it is the common way user data leaks through a CDN, and it has cost companies their reputations.

The right question is not "is this a GET" but "**is this response the same for every requester**." Those are different questions. Only the second one determines whether a shared cache is safe.

## The three-way split

Put your endpoints into these buckets.

**Public and identical for all** — product catalog, pricing pages, published articles, static config. Cache these in the CDN aggressively. The real win lives here.

```
Cache-Control: public, max-age=60, s-maxage=600, stale-while-revalidate=86400
```

**Personalized** — anything reflecting who is asking. This must never enter a shared cache:

```
Cache-Control: private, no-store
```

`private` lets browsers cache the response and bars shared caches from it. `no-store` bars everyone. Use `no-store` for anything sensitive. Use `private, max-age=...` when a per-user browser cache buys you something.

**Semi-public but segmented** — same for everyone in a region, locale, currency, or plan tier. These are cacheable, but the segmentation belongs in the cache key. Put it in the URL path (`/api/v1/us/catalog`). Failing that, use `Vary`. Know two things about `Vary`: on a high-cardinality header it shreds your hit rate, and `Vary: Cookie` turns caching off, because every session cookie is unique.

## What bites even on public data

**Invalidation.** Long TTLs are what make a CDN worth having, and they mean stale data until expiry. You need a purge path. Use tag-based purge, or content-hashed URLs, where a change produces a new URL and nothing needs purging. Decide this before you set long TTLs, not after your team publishes a wrong price.

**Authorization is not authentication.** An endpoint can be public-ish and still authorization-dependent — a document visible only to members of a workspace. Cache by URL alone and anyone holding the URL gets the content. Your permission check never runs. A cached response does not re-run your authorization code.

**Error responses.** A CDN caches a 500 or a 404 for the full TTL when the origin sends cacheable headers on it. One bad deploy becomes ten minutes of a cached error page. Set short or zero TTLs on error statuses.

**Cookies and Set-Cookie.** A response carrying `Set-Cookie` that lands in a shared cache hands that session cookie to the next requester. The major CDNs refuse to cache these by default. Verify yours does.

**Cache-key hygiene.** Query strings, header casing, trailing slashes, and tracking arguments like `utm_source` all fragment the cache. Normalize the key. Otherwise your hit rate lands far below what you expect, and you conclude caching does not help when the configuration was the problem.

## Whether it will even be fast

Check where the time goes before doing any of this. If an unindexed query on an authenticated endpoint dominates your p95, a CDN in front of public endpoints will not move it. Those endpoints cannot be cached.

A CDN also only pays off at a decent hit rate. Long-tail content gets few requests per object, so the hit rate stays low, and a miss costs more than no CDN at all — one extra network hop.

## A safer default to propose

Flip the polarity. Default everything to `no-store` at the framework level. Then opt specific routes into caching, each with a comment saying why the response is safe to share. Opt-in is the only version of this that fails safely. Opt-out means every new endpoint is a leak waiting for someone to remember.

Then add a test that fails the build when a route returning user data carries neither `private` nor `no-store`. It is cheap to write, and it catches the mistake in CI instead of in a support ticket.

**Short version:** cache the public endpoints, mark the personalized ones `private, no-store`, put segmentation in the URL instead of in `Vary`, and build the purge path before you set long TTLs. Caching all gets uniformly is a data leak with a performance improvement attached.

### Answer B

It will speed the app up, and it will also serve one user's private data to another. The caching is not the mistake. "Every GET endpoint" is.

## Why GET is not the right test

`GET` means the request has no side effects. It does not mean the response is the same for everyone. A shared CDN cache stores one copy per cache key — normally the URL — and hands it to whoever asks next.

So `GET /api/me` gets fetched once, by whichever user arrives first, then served to every later user until it expires. Same for `/api/cart`, `/api/notifications`, `/api/orders`. This is not hypothetical. It is the most common way user data leaks through a CDN.

The question to ask is not "is this a GET." It is "**is this response the same for every possible requester**." Only the second one decides whether a shared cache is safe.

## The three-way split

Sort your endpoints into these buckets.

**Public and identical for all** — product catalog, pricing pages, published articles, static config. Cache these aggressively. The real win lives here.

```
Cache-Control: public, max-age=60, s-maxage=600, stale-while-revalidate=86400
```

**Personalized** — anything reflecting who is asking. It must never enter a shared cache.

```
Cache-Control: private, no-store
```

`private` lets browsers cache it and forbids shared caches. `no-store` forbids everyone. Use `no-store` for anything sensitive, and `private, max-age=...` when a per-user browser cache genuinely helps.

**Semi-public but segmented** — same for everyone in a region, locale, currency, or plan tier. Cacheable, as long as the segmentation lives in the cache key. Prefer putting it in the URL path, like `/api/v1/us/catalog`. Failing that, use `Vary`, and know two things: `Vary` on a high-cardinality header shreds your hit rate, and `Vary: Cookie` disables caching in practice, because every session cookie is unique.

## Things that bite even on genuinely public data

**Invalidation.** Long TTLs are what make a CDN worth having, and they mean stale data until expiry. You need a purge path: tag-based purge, or content-hashed URLs so a change produces a new URL and nothing needs purging. Decide this before you set long TTLs, not after someone publishes a wrong price.

**Authorization is not authentication.** An endpoint can be public-ish and still authorization-dependent — a document visible only to one workspace. Caching by URL alone means anyone with the URL gets the content, because a cached response never re-runs your permission check.

**Error responses.** A CDN will cache a 500 or a 404 for the full TTL if the origin sends cacheable headers on it. One bad deploy becomes ten minutes of a cached error page. Set short or zero TTLs on error statuses explicitly.

**Cookies and Set-Cookie.** A response carrying `Set-Cookie` that lands in a shared cache hands that session cookie to the next requester. Most CDNs refuse to cache these by default. Verify yours does rather than assuming.

**Cache-key hygiene.** Query strings, header casing, trailing slashes, and tracking parameters like `utm_source` all fragment the cache. Normalize the key, or your hit rate will come in far below expectation and you will blame caching for a configuration problem.

## Whether it will even be fast

Check where the time goes before doing any of this. If your p95 is dominated by an unindexed query on an authenticated endpoint, a CDN in front of public endpoints will not move it, because those endpoints cannot be cached.

A CDN also only pays off at a decent hit rate. Long-tail content with few requests per object hits rarely, and a miss costs slightly *more* than no CDN, because of the extra network hop.

## A safer default to propose

Flip the polarity. Default everything to `no-store` at the framework level, then opt specific routes into caching, each with a comment saying why that response is safe to share. Opt-in is the only version that fails safely. Opt-out means every new endpoint is a potential leak until someone remembers.

Then add a test that fails the build when a route returning user data carries neither `private` nor `no-store`. Cheap to write, and it catches the mistake in CI instead of a support ticket.

**Short version:** cache the public endpoints, mark the personalized ones `private, no-store`, put segmentation in the URL rather than in `Vary`, and build the purge path before you set long TTLs. Caching all GETs uniformly is a data leak with a performance improvement attached.

---

## Pair 7

**The question that was asked:**

> An engineer asks why their retry logic caused duplicate charges in a payment system, and what idempotency has to do with it. Explain.

### Answer A

Your retry sent a second charge for a payment that had already gone through. The first request worked; its response never reached you. Your code could not tell "it failed" from "it worked and I did not hear back," so it retried, and the processor did what you asked twice.

## The failure in detail

A charge has two halves: the request going out and the response coming back. A timeout says only that the round trip did not finish. It does not say which half broke.

```
you ──── charge $50 ────▶ processor    money moves
you ◀─── 200 OK ──X────  processor     response lost
you: timeout → retry
you ──── charge $50 ────▶ processor    money moves again
```

Both cases look identical from your side. A dropped response, a load balancer killing a slow connection, your client timing out while the processor was still committing — each produces the same silence, and in each the charge may already exist.

Retrying more carefully will not fix this, and neither will a longer timeout. Every retry over a network has this property. The only question is whether the receiver absorbs the duplicate.

## What idempotency means here

An operation is idempotent when doing it twice has the same effect as doing it once. Reading a row is idempotent. Setting a balance to $50 is idempotent. Charging $50 is not, because each call adds a new fact to the world.

So make the *request* idempotent even though the *operation* is not. Attach a unique key to the charge, generated once, before the first attempt. Every retry of that logical charge carries the same key. The processor stores the key alongside the result. Seeing a key it already recorded, it skips the charge and replays the original response.

```
POST /charges
Idempotency-Key: 7a1f8c3e-...
{ "amount": 5000, "currency": "usd" }
```

The retry is now safe. The second request returns the first charge id, and the customer pays once.

## Getting it right

**Generate the key before the first attempt, not inside the retry.** This mistake quietly defeats the whole mechanism. A fresh key per attempt makes every retry look like a new charge, which puts you back where you started.

**Tie the key to the business intent, not the attempt.** One key per checkout, per invoice, per payout. A customer who genuinely buys the same item twice has two intents and gets two keys.

**Persist the key before you send.** If your process crashes mid-charge, it has to come back and reuse that key rather than invent one. Write a row first — key, amount, status `pending` — and you have it.

**Every major processor supports this.** Stripe, Adyen, Braintree, and PayPal all take an idempotency key, typically remembering it for 24 hours. Read your processor's exact semantics, especially what it does when a key returns with a *different* payload — most call that an error, which is a useful safety net.

**Retry only what is safe to retry.** Even with keys, retry timeouts, connection errors, and 5xx responses only. Do not retry a 4xx; the request was rejected on its merits and will be rejected again. Use exponential backoff with jitter so a brief processor problem does not become a stampede.

## The general lesson

Any retry that crosses a network and causes a side effect needs this: sending email, provisioning a resource, publishing a message, calling a partner API. Networks give you at-least-once delivery cheaply. Exactly-once is what you want, and you build it by teaching the receiver to recognize and drop duplicates. The idempotency key is how it recognizes them.

### Answer B

Your retry sent a second charge for a payment that had already succeeded. The first request worked. The response never came back to you. Your code cannot tell "it failed" apart from "it worked and I did not hear about it." So it retried, and the processor did what you asked, twice.

## The failure in detail

A charge request has two halves: your request going out, and the response coming back. A timeout tells you the round trip did not finish. It does not tell you which half failed.

```
you ──── charge $50 ────▶ processor    money moves
you ◀─── 200 OK ──X────  processor     response lost
you: timeout → retry
you ──── charge $50 ────▶ processor    money moves again
```

From your side both cases are identical. The network dropped the response. The load balancer killed a slow connection. Your client hit its timeout while the processor was still committing. Each of these produces the same silence, and in each one the charge already exists.

Retrying more carefully will not fix this. A longer timeout will not fix it either. Any retry over a network has this property. The one question is whether the receiving side absorbs the duplicate.

## What idempotency means here

An operation is idempotent when doing it twice has the same effect as doing it once. Reading a row is idempotent. Setting a balance to $50 is idempotent. Charging $50 is not, because each call adds a new fact to the world.

The fix makes the *request* idempotent even though the *operation* is not. You attach a unique key to the charge, generated once, before the first attempt. Every retry of that logical charge carries the same key. The processor stores the key with the result. When it sees a key it already recorded, it does not charge again. It replays the original response.

```
POST /charges
Idempotency-Key: 7a1f8c3e-...
{ "amount": 5000, "currency": "usd" }
```

Now the retry is safe. The second request returns the same charge id as the first, and the customer pays once.

## Getting it right

**Generate the key before the first attempt, not inside the retry.** This mistake quietly defeats the whole mechanism. Mint a new key per attempt and every retry is a brand new charge. You are back where you started.

**Tie the key to the business intent, not the attempt.** One key per checkout, per invoice, per payout. If the user buys the same item twice on purpose, that is two intents and two keys.

**Persist the key before you send the request.** Your own process can crash mid-charge. When it comes back it has to reuse the same key instead of inventing a fresh one. Write a row to your database first — key, amount, status `pending` — and you have that.

**Every major processor supports this.** Stripe, Adyen, Braintree, and PayPal accept an idempotency key header or field, and remember it for 24 hours. Read your processor's exact semantics. Check what happens when you reuse a key with a *different* payload — several treat that as an error, which catches a bug for you.

**Retry only what is safe.** Even with keys, retry on timeouts, connection errors, and 5xx responses. Do not retry a 4xx. The processor rejected the request on its merits and will reject it again. Add exponential backoff with jitter so a processor blip does not become a stampede.

## The general lesson

You need this anywhere a retry crosses a network and causes a side effect: sending email, provisioning a resource, publishing a message, calling a partner API. Networks give you "at-least-once delivery" cheaply. "Exactly once" is what you want, and you build it by making the receiver spot duplicates and discard them. The idempotency key is how the receiver spots them.

---

## Pair 8

**The question that was asked:**

> A junior engineer asks why adding an index to a database table made their writes slower, when everyone told them indexes make things faster. Explain.

### Answer A

Indexes make reads faster and writes slower. Both are true at once, and that trade is the point of an index. Nobody lied to you; they told you half.

## Why the write got slower

An index is a second copy of part of your data, kept sorted. Usually it is a B-tree holding the indexed column plus a pointer back to the row.

That copy has to stay correct, so every write does extra work:

- **Insert** — write the row, then place a new entry at its sorted position in the index. If that B-tree page is full, the page splits: allocate a new page, update the parent, and occasionally cascade further up the tree.
- **Update** — touching an indexed column removes the old entry and inserts a new one somewhere else, because the sort order changed. Updating a non-indexed column is cheaper, and some engines optimize that case directly.
- **Delete** — the index entry goes too.

Add a second index and you pay again. A table with eight indexes does eight extra structural updates per insert. That is why write-heavy tables stay lean on indexes and analytics tables do not.

Durability costs more too. Index changes go into the write-ahead log, so each transaction pushes more bytes to disk and dirties more pages that must eventually flush.

## The part that surprises people

Where the rows land matters enormously.

Index an auto-incrementing id or a timestamp and every new row lands at the right edge of the tree. That is the cheapest case: one hot page, always in memory, clean occasional splits.

Index a UUID v4 or anything random and every insert lands somewhere unpredictable. You touch a different page each time. Once the index outgrows memory, each insert first reads a page from disk before it can change it. Throughput can drop by ten times at exactly the moment the index stops fitting in RAM, which is why this reads as a cliff rather than a slope.

That cliff usually explains a slowdown that feels far too big for "one more index."

## What to do

**Check the index earns its keep.** Run `EXPLAIN` on the queries you added it for. An index no plan chooses is pure cost. Most databases report per-index usage counts; read them before adding another.

**Drop redundant indexes.** An index on `(a, b)` already serves queries filtering on `a` alone, because a leading column works by itself. A separate index on `(a)` is dead weight. This is the easiest win available.

**Reconsider the key.** On random UUIDs with heavy inserts, UUID v7 or ULID sort by time and restore the append-at-the-edge behavior.

**Batch inserts.** Spreading per-transaction overhead across many rows helps a lot. For bulk loads, dropping the index, loading, and rebuilding usually beats maintaining it row by row.

**Measure instead of reasoning.** Time the write path with and without the index at realistic volumes. The cost depends on table size, index count, key distribution, and how much of the index fits in memory. None of that carries over from someone else's benchmark.

## The rule to carry forward

Every index bets that you read a column far more often than you write the table. For most application tables the bet wins and the index is right. For high-volume append paths — event logs, metrics, audit trails, queues — the bet often loses, and the fix is fewer indexes, not more.

### Answer B

Indexes make reads faster and writes slower. Both are true at once. That tradeoff is the whole point of an index. Nobody lied to you. They told you half of it.

## Why the write got slower

An index is a second copy of part of your data, kept sorted. In PostgreSQL, MySQL, and SQL Server it is a B-tree holding the indexed column plus a pointer back to the row.

That copy has to stay correct. So every write does more work:

- **Insert** — the engine writes the row, then inserts a new entry into the index at the right sorted position. If the B-tree page it belongs on is full, the page splits. Splitting allocates a new page and updates the parent. Sometimes that cascades up the tree.
- **Update** — if you touched an indexed column, the sort order changed. The engine removes the old index entry and inserts a new one elsewhere. Updates to non-indexed columns are cheaper, and MySQL's InnoDB and Postgres's HOT updates optimize that case.
- **Delete** — the index entry goes too.

Add a second index and you pay that cost twice. A table with eight indexes does eight extra structural updates per insert. That is why write-heavy tables stay lean on indexes and analytics tables do not.

There is a durability cost as well. The engine logs the index changes to the write-ahead log. So each transaction pushes more bytes to disk, and dirties more pages in the buffer pool that must be flushed later.

## The part that surprises people

Where you insert matters enormously.

Put the index on an auto-incrementing id or a timestamp, and every new row lands at the right edge of the tree. That is the cheapest case: one hot page, in memory, with clean splits.

Put the index on a UUID v4 or anything random, and every insert lands somewhere unpredictable. You now touch a different page each time. Once the index outgrows memory, each insert costs a disk read to fetch the page before you can change it. Throughput can fall tenfold at the point the index stops fitting in RAM. That is why the slowdown arrives as a cliff instead of a slope.

That cliff explains a write slowdown that feels disproportionate to "one more index."

## What to do about it

**Confirm the index is earning its keep.** Run `EXPLAIN` on the queries you added it for. An index no query plan chooses is pure cost. Postgres and MySQL both report per-index usage counts. Check them before adding another.

**Drop redundant indexes.** An index on `(a, b)` already serves queries filtering on `a` alone, because a query can use the leading column by itself. A separate index on `(a)` is dead weight. This is the easiest win available.

**Reconsider the key.** If you are on random UUIDs and inserting at volume, switch to UUID v7 or ULID. They sort by time, which restores the append-at-the-edge behavior.

**Batch your inserts.** Spreading the per-transaction overhead across many rows cuts it sharply. For bulk loads, drop the index, load, and rebuild. That beats maintaining the index row by row.

**Measure instead of reasoning.** Time the write path with and without the index on realistic data volumes. The cost depends on table size, index count, key distribution, and how much of the index fits in memory. None of those generalize from another team's benchmark.

## The rule to carry forward

Every index is a bet that you will read that column far more than you write the table. For a typical application table the bet is correct, and adding the index is right. For a high-volume append path — event logs, metrics, audit trails, queues — the bet loses, and the fix is fewer indexes, not more.

---

## Pair 9

**The question that was asked:**

> A teammate says they are going to wrap every function they pass as a prop in useCallback, to stop child components re-rendering. Explain whether that will work.

### Answer A

No. On its own it does nothing, and it makes the code slower and harder to read.

## Why it does nothing

`useCallback` keeps a function identity stable between renders. That matters only when code downstream compares identities. A plain child component does not compare them. It re-renders every time its parent re-renders, whatever its props are.

```jsx
function Parent() {
  const handleClick = useCallback(() => doThing(), [])
  return <Child onClick={handleClick} />   // Child still re-renders
}
```

`Child` re-renders because `Parent` re-rendered. React does not check the props before re-rendering a child. It re-renders the tree.

For the memoization to bite, wrap the child in `React.memo`. That is the piece that compares props and bails out:

```jsx
const Child = React.memo(function Child({ onClick }) { ... })
```

Now the stable identity matters. `React.memo` shallow-compares props and skips the render when they all match. `useCallback` without `React.memo` is a no-op with overhead.

## Why it costs you

`useCallback` is not free. Every call allocates the dependency array, stores it, and compares it against the previous one on each render. Then it hands back the same function you would have created without it. Creating a closure in JavaScript is cheap — cheaper than the bookkeeping that avoids creating it.

So the blanket policy trades a cheap allocation for a costlier allocation plus a comparison, a few hundred times a render. It also adds a dependency array to every callback, and the team now has to keep each one correct.

## Why it breaks even when the memo is there

The dependency arrays are the trap. Miss a dependency and the callback closes over stale state, which is a real bug and a hard one to find. Include an unstable dependency and the memoization stops working silently:

```jsx
const config = { mode: "edit" }                     // new object every render
const handle = useCallback(() => save(config), [config])  // new function every render
```

The `useCallback` is still there. It never returns the cached value, so `React.memo` sees a changed prop and re-renders. You now hold the cost and the complexity with none of the benefit. The code reads as optimized, so nobody re-checks it.

One unstable prop anywhere on the child does the same. Memoize the callback perfectly, pass `style={{ margin: 8 }}` alongside it, and the bail-out never fires.

## When it is worth it

Reach for `useCallback` when you can name the reason:

- The child sits inside `React.memo` **and** re-rendering it costs measurable time — a large list, a chart, a canvas, a heavy table.
- The function is a dependency of another hook, where an unstable identity re-fires an effect. People forget this case. It is a correctness fix, not a performance one.
- The function goes to a third-party component documented as identity-sensitive.

In each case you can point at the mechanism that reads the identity. Without that mechanism, no benefit exists to collect.

## What to do instead

Find out what is slow. Open the React DevTools Profiler, record an interaction, and read which components render and how long they take. A "too many re-renders" complaint usually resolves to one expensive component, not a thousand cheap ones. Cheap re-renders are fine. React is built for them.

Then fix the cause the profiler names. The structural fix beats the memoized one: move state down so fewer components sit under it, pass children as a prop so the expensive subtree skips the parent's re-render, or split the component so the frequently-changing part stays small.

## One more thing worth knowing

On React 19 with the React Compiler enabled, the compiler inserts memoization where it helps, and hand-written `useCallback` becomes redundant. Check what the project runs before spending an afternoon doing it by hand.

## The summary to give them

Blanket `useCallback` is a cost with no matching benefit unless the children sit inside `React.memo`. Even then it pays off only when those children are expensive. Profile first, memoize the one thing the profiler names, and leave the rest alone.

### Answer B

No. On its own it does nothing at all, and it makes the code slower and harder to read.

## Why it does nothing

`useCallback` keeps a function identity stable between renders. That matters only if something downstream compares identities. A plain child component does not. It re-renders whenever its parent re-renders, whatever its props say.

```jsx
function Parent() {
  const handleClick = useCallback(() => doThing(), [])
  return <Child onClick={handleClick} />   // Child still re-renders
}
```

`Child` re-renders because `Parent` re-rendered. React does not check whether props changed before re-rendering a child. It re-renders the tree.

For the memoization to bite, the child has to be wrapped in `React.memo`, which is the thing that compares props and bails out:

```jsx
const Child = React.memo(function Child({ onClick }) { ... })
```

Now the stable identity matters, because `React.memo` shallow-compares props and skips the render when they all match. `useCallback` without `React.memo` is a no-op with overhead.

## Why it costs something

`useCallback` is not free. Every call allocates the dependency array, stores it, and compares it against the previous one on each render. Then it usually hands back the same function you would have created anyway. Creating a closure in JavaScript is cheap — in most cases cheaper than the bookkeeping needed to avoid creating it.

So the blanket policy trades a cheap allocation for a slightly less cheap allocation plus a comparison, several hundred times a render. It also adds a dependency array to every callback that somebody now has to keep correct.

## Why it often breaks even when the memo is there

The dependency arrays are the trap. Miss a dependency and the callback closes over stale state, which is a real bug and a hard one to find. Include an unstable dependency and the memoization quietly stops working:

```jsx
const config = { mode: "edit" }                     // new object every render
const handle = useCallback(() => save(config), [config])  // new function every render
```

The `useCallback` is still there. It just never returns the cached value, so `React.memo` sees a changed prop and re-renders anyway. You now have the cost, the complexity, and none of the benefit — and it looks optimized, so nobody re-checks it.

One unstable prop anywhere on the child does the same. Memoize the callback perfectly, then pass `style={{ margin: 8 }}` alongside it, and the bail-out never fires.

## When it is genuinely worth it

Reach for `useCallback` when you can name the reason:

- The child is wrapped in `React.memo` **and** re-rendering it is measurably expensive — a large list, a chart, a canvas, a heavy table.
- The function is a dependency of another hook, where an unstable identity re-fires an effect. People forget this case, and it is a correctness fix, not a performance one.
- The function goes to a third-party component documented as identity-sensitive.

In each of those you can point at the mechanism that reads the identity. If you cannot point at one, there is no benefit to collect.

## What to do instead

Find out what is actually slow. Open the React DevTools Profiler, record an interaction, and look at which components render and how long they take. Most "too many re-renders" complaints turn out to be one expensive component, not thousands of cheap ones. Cheap re-renders are fine — React is built for them.

Then fix the specific cause. The better fix is often structural rather than memoized: move state down so fewer components sit under it, pass children as a prop so the expensive subtree does not re-render with the parent, or split the component so the fast-changing part is small.

## One more thing worth knowing

On React 19 with the React Compiler enabled, memoization gets inserted automatically where it helps, and hand-written `useCallback` becomes redundant. Check what the project runs before anyone spends an afternoon doing it by hand.

## The summary to give them

Blanket `useCallback` is a cost with no matching benefit unless the children are wrapped in `React.memo`, and even then it pays off only when those children are expensive. Profile first, memoize the specific thing the profiler names, and leave the rest alone.

---

## Pair 10

**The question that was asked:**

> A teammate asks why their build broke after another team added a package. Two packages now depend on different versions of the same library. Explain what is happening and how to fix it.

### Answer A

Two packages ask for different versions of the same library. Your package manager picks one version for disk. That choice no longer satisfies one of the two.

## What is happening

Package managers resolve a range, not an exact version. Your existing package asks for `^1.4.0`. The new one asks for `^2.0.0`. Those ranges do not overlap, so no single version satisfies both.

From there, two outcomes are possible. Which one you get explains the shape of the break.

**The manager installs one copy.** npm and yarn hoist a single version to the top of `node_modules` when they can. The package that wanted the other version gets the hoisted one. It then breaks at runtime or at type-check, on an API that changed. This is the classic "worked yesterday" break.

**The manager installs both copies.** pnpm does this by default. npm does it when hoisting fails. Nothing is missing now, but you hold two separate module instances. Anything relying on shared identity breaks: `instanceof` checks fail across the boundary, singletons stop being single, React throws "invalid hook call" because two Reacts exist, and context providers do not reach consumers on the other copy.

The tell for the second case is a bigger bundle and errors that read as impossible — an object failing an `instanceof` check against the exact class that built it.

## How to see which one you have

```bash
npm ls <library>          # or pnpm why <library>
```

That prints every requester and the version each got. One version with multiple parents is case one. Two version numbers is case two.

## How to fix it

Work down this list. Stop at the first item that applies.

**Upgrade the older consumer.** The package pinned to `^1.4.0` may have a release that accepts `^2`. Upgrading it makes the ranges overlap and the problem disappears. This fix leaves no residue, so spend your time here before moving on.

**Make the library a peer dependency.** Some libraries must be a singleton — React, a state store, an ORM client. Packages depending on them should declare them in `peerDependencies`, not `dependencies`. That pushes the version choice up to your app, where exactly one copy gets installed. Change this in packages you own. File it upstream for packages you do not, because a singleton library shipped as a regular dependency is a bug.

**Force one version.** Every manager has an escape hatch: `overrides` in npm, `resolutions` in yarn, `pnpm.overrides` in pnpm.

```json
{
  "overrides": {
    "some-lib": "2.1.0"
  }
}
```

This tells the resolver that everyone gets 2.1.0, no matter what they asked for. It works, and it is a lie. The package that wanted v1 now runs against v2 untested. Use it after you have read the changelog and confirmed the breaking change misses the paths that package uses. Leave a comment saying why, plus an issue to remove it.

**Keep both, deliberately.** A library that holds no shared state — a date formatter, a string utility — costs you bundle size and nothing else in duplicate. Accept it and move on.

## What not to do

Do not delete the lockfile and reinstall. That reshuffles the resolution and can hide the conflict until a later install brings it back — in CI, on another branch.

Do not pin every dependency to an exact version to stop this recurring. It trades resolution surprises for a tree that never gets security patches.

## Preventing the next one

Add `npm ls` to CI, or `pnpm why` on the libraries that must be singletons, so a duplicate fails the build instead of surfacing as a runtime mystery. In a monorepo, declare shared libraries in one place — a catalog in pnpm, a single root dependency elsewhere — so packages cannot drift apart at all.

### Answer B

Two packages in your tree ask for different versions of the same library. Your package manager picked one answer, and that answer no longer satisfies one of them.

## What is happening

Package managers resolve a version *range*, not an exact version. Your old package asks for `^1.4.0`. The new one asks for `^2.0.0`. Those ranges do not overlap, so no single version satisfies both.

From there the manager does one of two things, and which one you got explains the shape of your break.

**It installs one copy.** npm and yarn hoist a single version to the top of `node_modules` when they can. The package that wanted the other version gets the hoisted one and breaks on an API that changed — at runtime, or at type-check. This is the classic "worked yesterday" failure.

**It installs both copies.** pnpm does this by default, and npm does it when hoisting fails. Nothing is missing now, but you have two separate module instances. Anything that depends on shared identity breaks: `instanceof` fails across the boundary, singletons stop being single, React throws "invalid hook call" because there are two Reacts, and a context provider never reaches consumers on the other copy.

The tell for two copies is a bigger bundle plus errors that read as impossible — an object failing an `instanceof` check against the exact class that built it.

## How to tell which one you have

```bash
npm ls <library>          # or pnpm why <library>
```

That prints every requester and the version each one got. One version with several parents means one copy. Two version numbers mean two copies.

## How to fix it

Work down this list. Stop at the first that applies.

**Upgrade the older consumer.** If the package pinned to `^1.4.0` has a release that accepts `^2`, upgrading makes the ranges overlap and the conflict disappears. This is the only fix that leaves nothing behind, so spend your time here before moving on.

**Make the library a peer dependency.** Some libraries must be a singleton — React, a state store, an ORM client. Packages that use one should declare it in `peerDependencies`, not `dependencies`. That pushes the version choice up to your app, where exactly one copy gets installed. Change it if you own the package. File it upstream if you do not, because a singleton library shipped as a regular dependency is a bug.

**Force one version.** Every manager has an escape hatch: `overrides` in npm, `resolutions` in yarn, `pnpm.overrides` in pnpm.

```json
{
  "overrides": {
    "some-lib": "2.1.0"
  }
}
```

This says "everyone gets 2.1.0, whatever they asked for." It works, and it is a lie you are telling the resolver. The package that wanted v1 now runs against v2 untested. Use it only after you have read the changelog and know the breaking change misses the paths that package uses. Leave a comment saying why, and an issue to remove it.

**Keep both, on purpose.** If the library holds no shared state — a date formatter, a string utility — two copies cost bundle size and nothing else. Accept it and move on.

## What not to do

Do not delete the lockfile and reinstall. That reshuffles the resolution and can hide the conflict until a later install brings it back, usually in CI, usually on someone else's branch.

Do not pin every dependency to an exact version to stop this recurring. You trade resolution surprises for a tree that never gets security patches.

## Preventing the next one

Add `npm ls` — or `pnpm why` on the libraries that must be singletons — to CI, so a duplicate fails the build instead of surfacing as a runtime mystery. In a monorepo, declare shared libraries in one place: a catalog in pnpm, a single root dependency elsewhere. Then packages cannot drift apart to begin with.
