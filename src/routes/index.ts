import { Router } from "express";
import orderRoutes from "./order.routes";

const router = Router();

// All feature routes here
router.use("/orders", orderRoutes);

export default router;
