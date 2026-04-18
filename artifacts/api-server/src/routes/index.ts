import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import accountsRouter from "./accounts";
import projectsRouter from "./projects";
import milestonesRouter from "./milestones";
import tasksRouter from "./tasks";
import resourcesRouter from "./resources";
import allocationsRouter from "./allocations";
import timesheetsRouter from "./timesheets";
import invoicesRouter from "./invoices";
import changeRequestsRouter from "./change_requests";
import notificationsRouter from "./notifications";
import dashboardRouter from "./dashboard";
import templatesRouter from "./templates";
import contractsRouter from "./contracts";
import accountHealthRouter from "./account_health";
import taskResourcesRouter from "./task_resources";
import financeRouter from "./finance";
import searchRouter from "./search";
import adminRouter from "./admin";
import milestoneCommentsRouter from "./milestone_comments";
import timeEntryCategoriesRouter from "./time_entry_categories";
import templateTasksRouter from "./template_tasks";
import fxRatesRouter from "./fx_rates";
import opportunitiesRouter from "./opportunities";
import taskCommentsRouter from "./task-comments";
import savedFiltersRouter from "./saved-filters";
import rateCardsRouter from "./rate-cards";
import prospectsRouter from "./prospects";

// Feature flag — CRM pipeline routes (prospects, opportunities)
// Set ENABLE_CRM_MODULES=true in .env to enable during development.
// In production (.env.production) this is false, so these routes return 404.
const CRM_ENABLED = process.env.ENABLE_CRM_MODULES === "true";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(accountsRouter);
router.use(projectsRouter);
router.use(milestonesRouter);
router.use(tasksRouter);
router.use(resourcesRouter);
router.use(allocationsRouter);
router.use(timesheetsRouter);
router.use(invoicesRouter);
router.use(changeRequestsRouter);
router.use(notificationsRouter);
router.use(dashboardRouter);
router.use(templatesRouter);
router.use(contractsRouter);
router.use(financeRouter);
router.use(accountHealthRouter);
router.use(searchRouter);
router.use(adminRouter);
router.use(milestoneCommentsRouter);
router.use(timeEntryCategoriesRouter);
router.use(taskResourcesRouter);
router.use(templateTasksRouter);
router.use(fxRatesRouter);
router.use(taskCommentsRouter);
router.use(savedFiltersRouter);
router.use(rateCardsRouter);

if (CRM_ENABLED) {
  router.use(opportunitiesRouter);
  router.use(prospectsRouter);
}

export default router;
