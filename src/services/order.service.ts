// Define our data structures based on the requirements
export interface StockAllocation {
  symbol: string;
  weight: number; // e.g., 0.60 for 60%
  marketPrice?: number; // Optional override
}

export interface OrderSplit {
  symbol: string;
  amount: number;
  quantity: number;
  executionPrice: number;
}

// Internal configuration for share decimal places (module-load time)
const sharePrecision = (() => {
  const raw = process.env.SHARE_PRECISION ?? "3";
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) ? parsed : 3;
})();

// Business logic to split an order based on model portfolio weights.

export function calculateOrderSplit(
  totalAmount: number,
  allocations: StockAllocation[],
): OrderSplit[] {
  // Validation here to ensure weights sum to ~1.0 (100%)
  const totalWeight = allocations.reduce((sum, alloc) => sum + alloc.weight, 0);

  if (Math.abs(totalWeight - 1.0) > 0.01) {
    throw new Error("Portfolio weights must sum to 100% (1.0).");
  }

  return allocations.map((allocation) => {
    // Use provided market price, or default to $100
    const executionPrice = allocation.marketPrice ?? 100.0;

    const allocatedAmount = totalAmount * allocation.weight;
    const rawQuantity = allocatedAmount / executionPrice;

    const multiplier = Math.pow(10, sharePrecision);
    const roundedQuantity = Math.round(rawQuantity * multiplier) / multiplier;

    const actualAmount = roundedQuantity * executionPrice;

    return {
      symbol: allocation.symbol,
      amount: Number(actualAmount.toFixed(2)), // Format money to 2 decimal places
      quantity: roundedQuantity,
      executionPrice: executionPrice,
    };
  });
}
