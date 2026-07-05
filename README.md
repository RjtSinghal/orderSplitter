# Order Splitter API

A POC backend service for a robo-advisor partner integration. Given a model portfolio (a set of stocks with target weights) and a total amount to invest or divest, the API splits the amount across the portfolio, calculates the number of shares per stock, determines the next valid trading day for execution, and keeps an in-memory history of submitted orders.

## Tech Stack / Dependencies

| Package                                              | Purpose                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| **express**                                          | HTTP server and routing                                                        |
| **zod**                                              | Runtime request validation (schema-based, replaces hand-rolled `if` checks)    |
| **dotenv**                                           | Loads configuration (e.g. share-quantity decimal precision) from a `.env` file |
| **typescript**                                       | Language / static typing                                                       |
| **ts-node**                                          | Runs TypeScript directly in development                                        |
| **nodemon**                                          | Auto-restarts the dev server on file changes                                   |
| **jest** + **ts-jest**                               | Test runner and TypeScript support for tests                                   |
| **@types/express**, **@types/node**, **@types/jest** | Type definitions                                                               |

No database — all data is held in memory and is intentionally lost on restart (see
Assumptions/Requirements below).

## Setup

npm install

## env

Create a `.env` file in the project root (a starting value is provided):

SHARE_PRECISION=3

`SHARE_PRECISION` controls how many decimal places share quantities are rounded to.
This can be changed (e.g. to `7`) without any code changes — see
[Configuration](#configuration) below.

## Running the app

```bash
# Development (auto-restarts on file changes)
npm run dev

# Production build
npm run build
npm start

# Run the test suite
npm test
```

The server starts on `http://localhost:3000` by default (override with a `PORT` env
variable).

Every request logs its response time in milliseconds to the console, e.g.:

[PERFORMANCE] POST /api/orders/split - 4.213 ms

## API Endpoints

### `POST /api/orders/split`

Splits a total amount across a model portfolio and returns the per-stock amount, share
quantity, and execution price, along with the next valid trading day.

**Request body**

```json
{
  "portfolioId": "Aggressive-Growth-01",
  "orderType": "BUY",
  "totalAmount": 100,
  "allocations": [
    { "symbol": "AAPL", "weight": 0.6 },
    { "symbol": "TSLA", "weight": 0.4, "marketPrice": 120.5 }
  ]
}
```

| Field                       | Type                | Required | Notes                                                                    |
| --------------------------- | ------------------- | -------- | ------------------------------------------------------------------------ |
| `portfolioId`               | string              | No       | Free-form identifier for the model portfolio                             |
| `orderType`                 | `"BUY"` \| `"SELL"` | Yes      |                                                                          |
| `totalAmount`               | number              | Yes      | Must be greater than 0                                                   |
| `allocations`               | array               | Yes      | At least one entry, weights must sum to 1.0 (100%), no duplicate symbols |
| `allocations[].symbol`      | string              | Yes      | Stock ticker                                                             |
| `allocations[].weight`      | number              | Yes      | Must be `> 0` and `<= 1`                                                 |
| `allocations[].marketPrice` | number              | No       | If supplied, overrides the fixed $100 default price for that stock       |

**Success response — `201 Created`**

```json
{
  "orderId": "ord_ba09fabdf1f2",
  "portfolioId": "Aggressive-Growth-01",
  "orderType": "BUY",
  "totalAmount": 100,
  "executionDate": "2026-07-06T09:57:43.891Z",
  "splits": [
    { "symbol": "AAPL", "amount": 60, "quantity": 0.6, "executionPrice": 100 },
    {
      "symbol": "TSLA",
      "amount": 40.01,
      "quantity": 0.332,
      "executionPrice": 120.5
    }
  ],
  "createdAt": "2026-07-05T09:57:43.892Z"
}
```

**Error responses**

- `400 Bad Request` — payload fails schema validation (missing/invalid fields, bad
  `orderType`, negative or zero `totalAmount`, out-of-range weight, duplicate symbols,
  etc.). Response includes a `details` object describing the failing field(s).
- `422 Unprocessable Entity` — payload is well-formed but the allocation weights don't
  sum to 1.0 (100%).

### `GET /api/orders/history`

Returns all orders submitted since the server started (in-memory only).

**Success response — `200 OK`**

```json
[
  {
    "orderId": "ord_ba09fabdf1f2",
    "portfolioId": "Aggressive-Growth-01",
    "orderType": "BUY",
    "totalAmount": 100,
    "executionDate": "2026-07-06T09:57:43.891Z",
    "splits": [
      /* ... */
    ],
    "createdAt": "2026-07-05T09:57:43.892Z"
  }
]
```

## Configuration

Share-quantity rounding precision is controlled via the `SHARE_PRECISION` environment
variable (defaults to `3` if unset or invalid), read once at process start:

SHARE_PRECISION=3

## Testing

npm test

Covers:

- Service-level unit tests: split math, weight-sum validation (including single-stock
  portfolios), market price override/priority, mixed-price portfolios, precision
  configuration, and the amount/quantity rounding-consistency guarantee.
- Controller-level unit tests: success and error paths (400/422) for the `split`
  endpoint, BUY/SELL handling, and order history behavior — using manually mocked
  Express `req`/`res` objects (no HTTP server is started during tests).
