import { Router } from 'express';
import { PayrollBonusController } from '../controllers/payrollBonusController.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { authorizeRoles } from '../middlewares/rbac.js';
import { require2FA } from '../middlewares/require2fa.js';

const router = Router();

router.use(authenticateJWT);
router.use(authorizeRoles('EMPLOYER'));

router.post('/runs', require2FA, PayrollBonusController.createPayrollRun);
router.get('/runs', PayrollBonusController.listPayrollRuns);
router.get('/runs/:id', PayrollBonusController.getPayrollRun);
router.patch('/runs/:id/status', require2FA, PayrollBonusController.updatePayrollRunStatus);
router.post('/items/bonus', PayrollBonusController.addBonusItem);
router.post('/items/bonus/batch', PayrollBonusController.addBatchBonusItems);
router.get('/runs/:payrollRunId/items', PayrollBonusController.getPayrollItems);
router.delete('/items/:itemId', PayrollBonusController.deletePayrollItem);
router.get('/bonuses/history', PayrollBonusController.getBonusHistory);

export default router;
