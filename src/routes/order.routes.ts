import { Router } from "express";
import { splitOrder, getOrderHistory } from "../controllers/order.controller";

const router = Router();

// Map endpoints to controller functions
router.post("/split", splitOrder);
router.get("/history", getOrderHistory);

export default router;
