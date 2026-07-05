import { Request, Response } from "express";
import {
  calculateOrderSplit,
  StockAllocation,
} from "../services/orderSplitter.service";
import crypto from "crypto";

// In-Memory Storage (will reset on server restart)
const historicOrders: any[] = [];

/**
 * Logic to ensure orders only execute Monday through Friday.
 */
const getNextTradingDay = (): string => {
  const date = new Date();
  const day = date.getDay();
  if (day === 6)
    date.setDate(date.getDate() + 2); // Saturday to Monday
  else if (day === 0) date.setDate(date.getDate() + 1); // Sunday to Monday
  return date.toISOString();
};

export const splitOrder = (req: Request, res: Response) => {
  try {
    const { portfolioId, orderType, totalAmount, allocations } = req.body;

    if (!totalAmount || !allocations || !Array.isArray(allocations)) {
      return res.status(400).json({
        error:
          "Invalid request payload. Ensure totalAmount and allocations are provided.",
      });
    }

    const splits = calculateOrderSplit(
      totalAmount,
      allocations as StockAllocation[],
    );
    const executionDate = getNextTradingDay();

    const orderRecord = {
      orderId: `ord_${crypto.randomBytes(6).toString("hex")}`,
      portfolioId,
      orderType,
      totalAmount,
      executionDate,
      splits,
      createdAt: new Date().toISOString(),
    };

    historicOrders.push(orderRecord);
    return res.status(200).json(orderRecord);
  } catch (error: any) {
    return res.status(422).json({ error: error.message });
  }
};

export const getOrderHistory = (req: Request, res: Response) => {
  return res.status(200).json(historicOrders);
};
