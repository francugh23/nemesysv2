# Bug Investigation

## Workflow
1. Establish a precise reproduction and expected behavior.
2. Trace the complete data/event path before choosing a suspect.
3. Compare with a working project pattern.
4. Gather runtime or static evidence at each boundary.
5. State confirmed facts separately from hypotheses.
6. Remove diagnostic instrumentation before completion.
7. Propose the smallest fix and regression verification; wait for approval when requested.

## Pitfalls
- Repeated speculative fixes.
- Assuming the first custom component is the cause.
- Leaving logs, temporary handlers, or debugging dependencies behind.
