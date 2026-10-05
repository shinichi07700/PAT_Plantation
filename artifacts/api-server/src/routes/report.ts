import { Router, type IRouter } from "express";
import { GetReportDataResponse, RefreshReportDataResponse } from "@workspace/api-zod";
import { reportData } from "../lib/sheets-report";

const router: IRouter = Router();
router.get("/report/data", async (_req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  res.json(GetReportDataResponse.parse(await reportData()));
});
router.post("/report/refresh", async (_req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  res.json(RefreshReportDataResponse.parse(await reportData(true)));
});
export default router;