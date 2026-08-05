---
"prosemeter": minor
"@prosemeter/core": minor
---

Make the root export browser-safe; move baseline persistence to `prosemeter/baseline`

`loadBaseline`, `saveBaseline`, and `DEFAULT_BASELINE_PATH` are no longer exported
from the package root. They live at a new `prosemeter/baseline` subpath:

```ts
import { loadBaseline, saveBaseline } from "prosemeter/baseline"
```

**Why.** The root export re-exported them as values, which put `./baseline` —
and with it `node:fs` and `node:path` — into the entry's module graph. The bundler
emitted `score` and `loadBaseline` into the same chunk, so `import { score } from
"prosemeter"` pulled a Node built-in into any browser bundle. `score` is now
reachable without it: three modules, zero `node:` specifiers.

`BaselineFile` is still exported as a type from the root, which emits no runtime
code. The CLI is unaffected — it always imported from the relative path.

All six library packages also declare `"sideEffects": false`, so bundlers can
tree-shake unused dimensions.
