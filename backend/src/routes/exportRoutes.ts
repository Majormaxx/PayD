import { Router } from 'express';
import { ExportController } from '../controllers/exportController.js';
import { exportDownloadAuth } from '../middlewares/exportDownloadAuth.js';
import { authenticateJWT } from '../middlewares/auth.js';

const router = Router();

router.get('/receipt/:txHash/pdf', exportDownloadAuth('receipt'), ExportController.getReceiptPdf);
router.get(
  '/payroll/:organizationPublicKey/:batchId/excel',
  exportDownloadAuth('payroll'),
  ExportController.getPayrollExcel
);
router.get(
  '/payroll/:organizationPublicKey/:batchId/csv',
  exportDownloadAuth('payroll'),
  ExportController.getPayrollCsv
);

router.post('/download-token', authenticateJWT, ExportController.issueDownloadToken);
router.post('/payroll-jobs/excel', authenticateJWT, ExportController.startPayrollExcelJob);
router.get('/payroll-jobs/:jobId', authenticateJWT, ExportController.getPayrollExportJobStatus);
router.get('/payroll-jobs/:jobId/download', authenticateJWT, ExportController.downloadPayrollExportJob);

export default router;
