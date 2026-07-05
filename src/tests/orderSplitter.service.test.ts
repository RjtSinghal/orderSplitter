import { calculateOrderSplit } from "../services/orderSplitter.service";

describe("Order Splitter Service", () => {
  it("should split orders correctly using the default $100 price", () => {
    const allocations = [
      { symbol: "AAPL", weight: 0.6 },
      { symbol: "TSLA", weight: 0.4 },
    ];

    const result = calculateOrderSplit(100, allocations);

    expect(result).toHaveLength(2);

    // AAPL check: $60 amount, 0.600 shares at $100/share
    expect(result[0].symbol).toBe("AAPL");
    expect(result[0].amount).toBe(60);
    expect(result[0].quantity).toBe(0.6);
    expect(result[0].executionPrice).toBe(100);

    // TSLA check: $40 amount, 0.400 shares at $100/share
    expect(result[1].symbol).toBe("TSLA");
    expect(result[1].amount).toBe(40);
    expect(result[1].quantity).toBe(0.4);
  });

  it("should prioritize market price if provided", () => {
    const allocations = [{ symbol: "AAPL", weight: 1.0, marketPrice: 150.0 }];

    const result = calculateOrderSplit(300, allocations);

    expect(result[0].amount).toBe(300);
    expect(result[0].executionPrice).toBe(150);
    expect(result[0].quantity).toBe(2.0); // 300 / 150
  });

  it("should throw an error if portfolio weights do not sum to 100%", () => {
    const allocations = [
      { symbol: "AAPL", weight: 0.5 },
      { symbol: "TSLA", weight: 0.4 }, // Sums to 0.90
    ];

    expect(() => calculateOrderSplit(100, allocations)).toThrow(
      "Portfolio weights must sum to 100% (1.0).",
    );
  });
});
