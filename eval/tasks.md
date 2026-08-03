# Task set

T1–T4 were used in the 2026-08-02 run 1. T5 and T6 were added for run 2 as *trap tasks*: the
correct answer requires a load-bearing qualifier, so an instruction that deletes qualifiers
produces a confidently wrong answer rather than a merely thin one. See `traps.mjs`.

T1: A teammate asks why their build broke after another team added a package. Two packages now depend on different versions of the same library. Explain what is happening and how to fix it.
T2: A junior engineer asks why adding an index to a database table made their writes slower, when everyone told them indexes make things faster. Explain.
T3: An engineer asks why their retry logic caused duplicate charges in a payment system, and what idempotency has to do with it. Explain.
T4: A React developer's page gets slower the longer it is open. They have a useEffect that subscribes to a websocket. Explain what is likely wrong and how to fix it.
T5: A teammate says they are going to wrap every function they pass as a prop in useCallback, to stop child components re-rendering. Explain whether that will work.
T6: A teammate wants to cache the response of every GET endpoint in a shared CDN cache to speed the app up. Explain whether that will work.
