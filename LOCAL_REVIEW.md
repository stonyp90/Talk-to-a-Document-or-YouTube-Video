# Local edge-case review

This records the disposition of required edge cases, not permission to call the
release complete. Host acceptance was rerun after integration on 2026-09-07.
Live provider, public hosting and native runtime gates remain separate.

| Case                                              | Evidence reviewed                                                                           | Disposition                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| PDF size, exact 25 MB boundary and one extra byte | `packages/core/src/domain/ingestion.test.ts`; `features/ingestion.feature`                  | Domain tests passed; full browser boundary checked by local BDD                         |
| Invalid file type and renamed non-PDF bytes       | `packages/adapters/src/ingestion.test.ts`; `packages/adapters/src/upload-routes.test.ts`    | Validation tests passed; real parser rejects renamed input                              |
| Empty PDF / no extractable text                   | `features/ingestion.feature`; upload route tests                                            | Actionable error fixed after failing test; rebuilt image BDD passed                     |
| Invalid URL / protocol / video identifier         | `packages/core/src/domain/ingestion.test.ts`                                                | HTTP/S and exact identifier validation tests passed                                     |
| Unavailable captions                              | `packages/adapters/src/providers.test.ts`; `services/transcript/test_app.py`                | Explicit error mapping and deterministic no-captions case tested                        |
| Cloud-blocked caption retrieval                   | Same provider and Python tests                                                              | Injected blocked response tested; actual AWS behavior pending deployment                |
| Poor-network timeout and reconnect                | `tests/e2e/webrtc-transport.spec.ts`; client unit tests                                     | Four controlled transport tests passed on the rebuilt production image                  |
| Microphone permission denial                      | `features/fallback.feature`; client unit tests                                              | Controlled browser denial covered; real device permissions pending                      |
| Cancellation, source replacement, late response   | `tests/e2e/session-races.spec.ts`; `apps/web/src/lib/page-lifecycle.test.tsx`               | Fault-injection regression and real React unmount tests passed                          |
| Security / server credentials                     | `packages/adapters/src/response.test.ts`; `infrastructure/scripts/check-client-secrets.mjs` | Ephemeral contract tests and final canary build/scan passed                             |
| Mobile width and long content                     | `tests/e2e/home.spec.ts`; `tests/e2e/responsive-edge.spec.ts`                               | Unbroken text layout regression found, CSS fixed; final image tests passed              |
| Native iOS and Android states                     | `apps/mobile/README.md`; `apps/mobile/EAS.md`                                               | Bundle/unit checks and installed iOS mock UI passed; Android/audio gates remain pending |

The review covers invalid file, empty extraction, invalid URL, unavailable
captions, blocked upstream, network failure, permission handling, reconnect,
credentials and mobile states. Pending dispositions are intentional and must
not be changed to passed without corresponding execution evidence.
