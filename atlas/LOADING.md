# Atlas loading

Regenerate transfer packs with `node scripts/build-atlas-packs.mjs` after updating anatomical assets. The pack manifest maps every GLB to a byte range, retaining its original bytes, individual identities, picking and source coordinates. Packs are split by reference, level, system and region; the male overview is grouped separately so the initial scene does not download unrelated organs. Single-structure scenes keep individual transfers to avoid downloading unnecessary packs.

The loader shares in-flight requests within each navigation signal, schedules different packs across six workers, bounds the public-data memory cache, and falls back to original files when a pack is unavailable. Hash-named packs receive immutable browser-cache headers. No account information is cached.

| Scene | Model downloads before | Pack downloads after |
|---|---:|---:|
| Initial body (default layers) | 245 | 19 |
| Heart | 83 | 5 |

`npm run benchmark:atlas` compares the same 245 source objects and production GLTF decoder with an injected latency of 80 ms per transfer, starting with empty application caches. On the development machine: 5,800 ms before, 371 ms after; 3,592,040 model bytes in both cases. These are controlled transfer/decoder measurements, not a promise for end-to-end page loading on every device. Catalogue loading, materials, GPU rendering and actual network conditions add their own time.

`npm run test:atlas` verifies every packed byte range against the original asset, request reduction, concurrency, cancellation, fallback, geometry, navigation and progress persistence.
