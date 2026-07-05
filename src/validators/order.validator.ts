import { z } from "zod";

export const StockAllocationSchema = z.object({
  symbol: z.string().trim().min(1, "symbol is required").toUpperCase(),
  weight: z
    .number({ error: "weight must be a number" })
    .gt(0, "weight must be greater than 0")
    .lte(1, "weight must be less than or equal to 1"),
  marketPrice: z
    .number({ error: "marketPrice must be a number" })
    .positive("marketPrice must be greater than 0")
    .optional(),
});

export const OrderTypeSchema = z.enum(["BUY", "SELL"]);

export const SplitOrderRequestSchema = z.object({
  portfolioId: z.string().trim().min(1).optional(),
  orderType: OrderTypeSchema,
  totalAmount: z
    .number({ error: "totalAmount must be a number" })
    .positive("totalAmount must be greater than 0"),
  allocations: z
    .array(StockAllocationSchema)
    .min(1, "allocations must contain at least one stock")
    .refine(
      (allocations) => {
        const symbols = allocations.map((a) => a.symbol);
        return new Set(symbols).size === symbols.length;
      },
      { message: "allocations must not contain duplicate symbols" },
    ),
});

export type SplitOrderRequest = z.infer<typeof SplitOrderRequestSchema>;
