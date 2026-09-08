Run `node --experimental-strip-types tests/sediment.mjs` with Node 22.13 or newer.

Checks conservation across periodic boundaries, nonnegative heights, repose tolerance (2 cm between sampled neighbours), calm threshold, reset, cardinal wind response, smaller-mound migration, and periodic boundary transport. These are numerical invariants and qualitative checks, not field-data validation or a calibration to calendar time.


Rendering checks: `node --experimental-strip-types tests/rendering.mjs`. These exercise the actual renderer with an instrumented graphics context: unchanged views, five updates per second, full-rate camera turns, altitude/view transitions, resize, hidden tabs, grain view and cleanup. No terrain geometry, shading samples or default pixel density are reduced.

CPU benchmark: `node --experimental-strip-types tests/performance.mjs`. Compare startup and 30 steady / 30 strong-variable model steps on the same machine, with no other benchmark running. Topology caching adds a 1 MiB fixed neighbour table and removes per-pair coordinate work from the avalanche loop.
