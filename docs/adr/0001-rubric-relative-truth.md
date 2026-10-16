# Opal resolves rubric-relative truth, not absolute truth

Each assertion carries an immutable Resolution Spec that names its authoritative sources in priority order, its definitions and its ambiguity handling. The LLM resolver and voters apply that spec; they do not judge reality. The same statement text can therefore resolve differently in two assertions.

**Why.** Natural-language statements have no single objective verifier ("postponed" by whose definition, and as of when?). Making the asserter declare the criteria turns an unbounded question into a bounded one, and lets one oracle serve integrations with different standards.

**Consequence.** A bad spec produces a faithfully applied bad answer, so integrators must read the spec before trusting an outcome. The rules a spec must follow are in [protocol.md](../protocol.md).
