Your build pipeline is failing due to a transitive dependency resolution conflict wherein multiple workspace packages declare divergent semantic versioning ranges targeting an identical upstream module.

**Root cause analysis:** during the bundling phase, the resolution algorithm performs deterministic deduplication and subsequently hoists a singular instantiation into the canonical location, thereby causing the non-privileged consumer to encounter a structural interface incompatibility at execution time. The resultant diagnostic manifests as a nominal type mismatch referencing a compilation unit situated outside your immediate mutation surface, which substantially degrades diagnostic observability.

**Remediation strategy:** the recommended approach entails hoisting the shared dependency declaration to the workspace root manifest, thereby enforcing singleton resolution semantics uniformly across all downstream consumers.

```bash
pnpm add -w zod@3.23.8
pnpm --filter core --filter api remove zod
pnpm install
```

**Rationale:** subsequent to this intervention, the resolution algorithm is presented with a singular viable candidate, consequently eliminating the nondeterminism that was previously responsible for precipitating the incompatibility.

Should the regression subsequently recur, the probable etiology is a newly onboarded package introducing an incompatible constraint specification. Interrogating the lockfile is the recommended initial diagnostic procedure, insofar as the duplication will manifest as multiple discrete entries sharing an identical package identifier while exhibiting divergent version specifiers, thereby facilitating localization of the offending consumer.
