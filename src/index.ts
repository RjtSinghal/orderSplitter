import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import apiRoutes from "./routes";

const app = express();

app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime();
  res.on("finish", () => {
    const diff = process.hrtime(start);
    const timeInMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(3);
    console.log(
      `[PERFORMANCE] ${req.method} ${req.originalUrl} - ${timeInMs} ms`,
    );
  });
  next();
});

// --- Routes ---
app.use("/api", apiRoutes);

// --- Server Initialization ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Order Splitter API is running on http://localhost:${PORT}`);
});
