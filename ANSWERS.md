# ANSWERS

---

## 1. Approach

- Built the split calculation as a **pure, isolated function** first (no HTTP/Express) — easy to test independently.
- Layered a thin REST API on top: **routes → controller → service**, each with one job.
- Once the core flow worked, hardened it:
  - Zod schema validation (replacing manual `if` checks)
  - Configurable share precision via env var
  - Response-time logging middleware
- Treated the grading criteria as a checklist: **design → code quality → tests → edge cases.**
- Fixed correctness bugs _before_ writing tests, so tests verify working logic, not lock in bugs.

---

## 2. Assumptions

| #   | Area                  | Assumption                                                                                                                                                                                                               |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Pricing**           | Default $100/stock; a supplied `marketPrice` overrides it, per-stock (can mix within one portfolio)                                                                                                                      |
| 2   | **Weight validation** | Weights must always sum to 100% — **even for a single-stock portfolio** (weight must be exactly `1.0`), otherwise part of the amount would go unallocated                                                                |
| 3   | **SELL orders**       | Use the **same math as BUY** (e.g. "sell $40 of TSLA"), not tied to actual holdings — holdings-aware selling was out of scope for this POC                                                                               |
| 4   | **Rounding**          | `amount` is derived **from the rounded share quantity** (`amount = quantity × price`), so each stock's amount and quantity always agree. Tradeoff: the total across all stocks may be a few cents off from `totalAmount` |
| 5   | **Execution timing**  | `getNextTradingDay` only shifts weekends → Monday. No holiday calendar, no market-hours cutoff, no timezone handling                                                                                                     |
| 6   | **Precision config**  | One global setting (`SHARE_PRECISION` env var), not per-request or per-stock                                                                                                                                             |
| 7   | **`portfolioId`**     | Optional, opaque label — not used in any logic                                                                                                                                                                           |
| 8   | **Persistence**       | In-memory only, resets on restart — per the explicit requirement                                                                                                                                                         |

---

## 3. Challenges

- **Silent falsy-check bug** — `!totalAmount` accidentally let `0` _and_ negative amounts through. Fixed with explicit Zod range checks.

- **Amount/quantity mismatch** — `amount` was calculated _before_ rounding `quantity`, so the two didn't always agree. Fixed by deriving `amount` from the rounded quantity instead.

- **Validation regression** — a fix meant to support single-stock portfolios accidentally _skipped_ weight validation for them entirely, silently allocating only part of the requested amount. Caught by manually testing the live server with a deliberately partial single-stock weight, not just by reading the code.

- **Silent config bug** — `.env` wasn't actually being loaded (missing `dotenv` import), so a config change had zero effect while looking correct by coincidence. Caught by changing the value and verifying the live response actually changed.

**Takeaway:** passing tests don't guarantee correct runtime behavior — several of these were only caught by manually hitting the running API with deliberately awkward inputs.

---

## 4. Production Migration Plan

| Area                              | Change                                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| **Storage**                       | Replace in-memory array with a real DB (e.g. PostgreSQL), behind a repository interface |
| **Auth**                          | API key / OAuth2 / JWT, scoped per partner                                              |
| **Validation & abuse prevention** | Rate limiting, payload size limits, ticker allow-listing                                |
| **Idempotency**                   | Idempotency keys on order submission to avoid duplicate orders from retries             |
| **Pricing**                       | Real market-data feed, with caching + fallback if unavailable                           |
| **Market calendar**               | Real holiday/hours-aware trading-day service                                            |
| **Secrets**                       | Move config out of `.env` into a secrets manager (e.g. AWS Secrets Manager)             |
| **Observability**                 | Structured logs + metrics/tracing instead of `console.log`                              |
| **Security hardening**            | HTTPS, CORS allow-list, security headers (`helmet`), audit logging                      |

---

## 5. LLM Usage

Used as an **iterative reviewer/pair-programmer**, not a one-shot code generator.

- **Requirement breakdown** — parsed the brief up front, flagged intentionally ambiguous areas before coding started.

- **Code review against the brief** — caught real bugs: unused `orderType`, the falsy-check validation gap, and later the single-stock validation regression (confirmed by actually running the server, not just reading the diff).

- **Tool explanations** — asked it to explain Zod and Supertest before deciding how to structure tests; chose plain Jest + manual mocks over Supertest deliberately, rather than defaulting to a suggestion.

- **Test design** — helped identify edge cases (weight-sum boundaries, `marketPrice: 0`, mixed pricing, rounding-consistency) and draft test files, which were then run and adjusted locally.

- **Documentation** — this file and the README were drafted collaboratively from decisions made during the build.

Every suggested change was compiled, run, and manually tested before being accepted — the single-stock validation bug specifically was only caught by testing runtime behavior, not by reading code.
