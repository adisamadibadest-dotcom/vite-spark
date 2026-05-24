import { Router, type IRouter } from "express";
import healthRouter from "./health";
import apexRouter from "./apex";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(apexRouter);
router.use(adminRouter);

export default router;
