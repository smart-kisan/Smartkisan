import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profileRouter from "./profiles";
import marketplaceRouter from "./marketplace";
import ledgerRouter from "./ledger";
import governmentRouter from "./government";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(profileRouter);
router.use(marketplaceRouter);
router.use(ledgerRouter);
router.use(governmentRouter);
router.use(aiRouter);

export default router;
