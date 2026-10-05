import { Router, type IRouter } from "express";
import healthRouter from "./health";
import reportRouter from "./report";

const router: IRouter = Router();

router.use(healthRouter);
router.use(reportRouter);

export default router;
