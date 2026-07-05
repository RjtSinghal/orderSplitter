import { calculateOrderSplit } from "../services/order.service";

describe("Order Splitter Service", () => {
  afterEach(() => {
    delete process.env.SHARE_PRECISION;
    jest.resetModules();
  });

  it("should split orders correctly using the default $100 price", () => {
    const allocations = [
      { symbol: "AAPL", weight: 0.6 },
      { symbol: "TSLA", weight: 0.4 },
    ];

    const result = calculateOrderSplit(100, allocations);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      symbol: "AAPL",
      amount: 60,
      quantity: 0.6,
      executionPrice: 100,
    });
    expect(result[1]).toMatchObject({
      symbol: "TSLA",
      amount: 40,
      quantity: 0.4,
      executionPrice: 100,
    });
  });

  it("should prioritize a per-stock market price override over the default $100", () => {
    const allocations = [{ symbol: "AAPL", weight: 1.0, marketPrice: 150.0 }];

    const result = calculateOrderSplit(300, allocations);

    expect(result[0].executionPrice).toBe(150);
    expect(result[0].quantity).toBe(2.0); // 300 / 150
  });

  it("should support a mixed portfolio — some allocations with marketPrice, some without", () => {
    const allocations = [
      { symbol: "AAPL", weight: 0.5, marketPrice: 200 }, // overridden
      { symbol: "TSLA", weight: 0.5 }, // default $100
    ];

    const result = calculateOrderSplit(200, allocations);

    expect(result[0].executionPrice).toBe(200);
    expect(result[1].executionPrice).toBe(100);
  });

  it("should handle a single-stock portfolio at exactly weight 1.0", () => {
    const allocations = [{ symbol: "AAPL", weight: 1.0 }];

    const result = calculateOrderSplit(500, allocations);

    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(500);
    expect(result[0].quantity).toBe(5);
  });

  it("should throw if portfolio weights sum below 1.0", () => {
    const allocations = [
      { symbol: "AAPL", weight: 0.5 },
      { symbol: "TSLA", weight: 0.4 }, // sums to 0.9
    ];

    expect(() => calculateOrderSplit(100, allocations)).toThrow(
      "Portfolio weights must sum to 100% (1.0).",
    );
  });

  it("should throw if portfolio weights sum above 1.0", () => {
    const allocations = [
      { symbol: "AAPL", weight: 0.7 },
      { symbol: "TSLA", weight: 0.5 }, // sums to 1.2
    ];

    expect(() => calculateOrderSplit(100, allocations)).toThrow(
      "Portfolio weights must sum to 100% (1.0).",
    );
  });

  it("should treat a marketPrice of exactly 0 as a valid override (not fall back to $100)", () => {
    // `??` only falls through on null/undefined, so 0 should be respected as-is.
    const allocations = [{ symbol: "AAPL", weight: 1.0, marketPrice: 0 }];

    const result = calculateOrderSplit(100, allocations);

    expect(result[0].executionPrice).toBe(0);
  });

  it("should derive amount from the rounded quantity, keeping amount and quantity internally consistent", () => {
    // $100 total, single stock at 100% weight, price $120.50 — deliberately does not divide evenly
    const allocations = [{ symbol: "TSLA", weight: 1.0, marketPrice: 120.5 }];

    const result = calculateOrderSplit(100, allocations);
    const { quantity, executionPrice, amount } = result[0];
    const impliedAmount = Number((quantity * executionPrice).toFixed(2));

    // Core guarantee: amount must always equal quantity × price, to the cent.
    expect(amount).toBe(impliedAmount);
  });

  it("should round share quantity to the configured SHARE_PRECISION (default 3)", () => {
    const allocations = [{ symbol: "AAPL", weight: 1, marketPrice: 3 }];

    const result = calculateOrderSplit(100, allocations);

    // 100 / 3 = 33.3333... -> rounded to 3 decimals (default) = 33.333
    expect(result[0].quantity).toBe(33.333);
  });

  it("should respect a custom SHARE_PRECISION env value at module load time", () => {
    jest.resetModules();
    process.env.SHARE_PRECISION = "5";

    // Re-require after resetModules so the module-level `sharePrecision`
    // constant is recomputed from the new env value.
    const {
      calculateOrderSplit: calculateWithPrecision5,
    } = require("../services/order.service");

    const result = calculateWithPrecision5(100, [
      { symbol: "AAPL", weight: 1, marketPrice: 3 },
    ]);

    // 100 / 3 = 33.33333... -> rounded to 5 decimals = 33.33333
    expect(result[0].quantity).toBe(33.33333);
  });

  it("should fall back to precision 3 when SHARE_PRECISION is unset or invalid", () => {
    jest.resetModules();
    process.env.SHARE_PRECISION = "not-a-number";

    const {
      calculateOrderSplit: calculateWithFallback,
    } = require("../services/order.service");

    const result = calculateWithFallback(100, [
      { symbol: "AAPL", weight: 1, marketPrice: 3 },
    ]);

    expect(result[0].quantity).toBe(33.333);
  });
});
