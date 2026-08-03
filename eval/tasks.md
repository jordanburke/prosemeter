# Task set

**T1–T4** were used in run 1. **T5–T6** were added for run 2 as trap tasks: the correct answer
requires a load-bearing qualifier, so an instruction that deletes qualifiers produces a confidently
wrong answer rather than a merely thin one. See `traps.mjs`.

**T7–T10** were added for run 4 to break the register monotony. T1–T6 are all one shape — someone
asks a question, the answer explains a concept — and a good explanation runs about the same length
regardless of who asks. That leaves length free to move with the instruction, which is why `words`
scored a variance ratio of 0.7 and became the gate's best signal.

T7–T10 are review, planning, diagnosis, and disagreement. Their natural lengths differ from each
other and from an explanation, so they test whether that ratio survives a heterogeneous task set.
If it does not, `words` is an artifact of the old set and `compare.mjs` needs rethinking.

## Explain a concept

T1: A teammate asks why their build broke after another team added a package. Two packages now depend on different versions of the same library. Explain what is happening and how to fix it.
T2: A junior engineer asks why adding an index to a database table made their writes slower, when everyone told them indexes make things faster. Explain.
T3: An engineer asks why their retry logic caused duplicate charges in a payment system, and what idempotency has to do with it. Explain.
T4: A React developer's page gets slower the longer it is open. They have a useEffect that subscribes to a websocket. Explain what is likely wrong and how to fix it.

## Trap tasks (a load-bearing qualifier decides correctness)

T5: A teammate says they are going to wrap every function they pass as a prop in useCallback, to stop child components re-rendering. Explain whether that will work.
T6: A teammate wants to cache the response of every GET endpoint in a shared CDN cache to speed the app up. Explain whether that will work.

## Other registers (run 4)

T7 — code review. A colleague opens a pull request with this change and asks you to review it:

```ts
export async function getUser(id: string) {
  const cached = cache.get(id)
  if (cached) return cached
  const rows = await db.query(`SELECT * FROM users WHERE id = '${id}'`)
  cache.set(id, rows[0])
  return rows[0]
}
```

T8 — planning. Your team runs a single Postgres database behind a Node API. Reads have grown to the point where the primary is saturated during business hours, and the team wants to add a read replica. Lay out how you would approach it.

T9 — diagnosis. A service started returning 502s about an hour ago. Nothing shipped today. The pod logs show `FATAL: sorry, too many clients already` and the pod restart count is climbing. Work out what is happening and what to do first.

T10 — disagreement. A teammate proposes deleting every test that has failed more than twice in the last month, so the suite goes green and the team stops ignoring CI. Tell them what you think.
