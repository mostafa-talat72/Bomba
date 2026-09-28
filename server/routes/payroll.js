import express from 'express';
import { protect as auth, authorize } from '../middleware/auth.js';
import * as employeeController from '../controllers/employeeController.js';
import * as attendanceController from '../controllers/attendanceController.js';
import * as advanceController from '../controllers/advanceController.js';
import * as payrollController from '../controllers/payrollController.js';
import * as deductionController from '../controllers/deductionController.js';
import * as paymentController from '../controllers/paymentController.js';
import * as bonusController from '../controllers/bonusController.js';

const router = express.Router();

// ═══════════════════════════════════════
// Employee Routes
// ═══════════════════════════════════════
router.get('/employees', auth, employeeController.getEmployees);
router.get('/employees/stats', auth, employeeController.getEmployeeStats);
router.get('/employees/:id', auth, employeeController.getEmployeeById);
router.post('/employees', auth, authorize('canAddEmployee', 'all'), employeeController.createEmployee);
router.put('/employees/:id', auth, authorize('canEditEmployee', 'all'), employeeController.updateEmployee);
router.delete('/employees/:id', auth, authorize('canDeleteEmployee', 'all'), employeeController.deleteEmployee);

// ═══════════════════════════════════════
// Attendance Routes
// ═══════════════════════════════════════
router.get('/attendance', auth, attendanceController.getAttendance);
router.get('/attendance/summary', auth, attendanceController.getAttendanceSummary);
router.get('/attendance/:employeeId/:month', auth, attendanceController.getAttendanceByMonth);
router.post('/attendance', auth, authorize('canEditEmployee', 'all'), attendanceController.markAttendance);
router.post('/attendance/bulk', auth, authorize('canEditEmployee', 'all'), attendanceController.bulkMarkAttendance);
router.put('/attendance/:id', auth, authorize('canEditEmployee', 'all'), attendanceController.updateAttendance);
router.delete('/attendance/:id', auth, authorize('canEditEmployee', 'all'), attendanceController.deleteAttendance);

// ═══════════════════════════════════════
// Advance Routes
// ═══════════════════════════════════════
router.get('/advances', auth, advanceController.getAdvances);
router.get('/advances/stats', auth, advanceController.getAdvanceStats);
router.get('/advances/:id', auth, advanceController.getAdvanceById);
router.get('/advances/employee/:employeeId/active', auth, advanceController.getActiveAdvances);
router.post('/advances', auth, advanceController.requestAdvance);
router.put('/advances/:id/status', auth, authorize('canApproveAdvance', 'all'), advanceController.updateAdvanceStatus);
router.put('/advances/:id', auth, authorize('canApproveAdvance', 'all'), advanceController.updateAdvance);
router.post('/advances/:id/disburse', auth, authorize('canApproveAdvance', 'all'), advanceController.disburseAdvance);
router.post('/advances/:id/deduction', auth, authorize('canApproveAdvance', 'all'), advanceController.recordAdvanceDeduction);
router.delete('/advances/:id', auth, authorize('canApproveAdvance', 'all'), advanceController.deleteAdvance);

// ═══════════════════════════════════════
// Deduction Routes
// ═══════════════════════════════════════
router.get('/deductions', auth, deductionController.getDeductions);
router.post('/deductions', auth, authorize('canAddManualDeduction', 'all'), deductionController.createDeduction);
router.put('/deductions/:id', auth, authorize('canAddManualDeduction', 'all'), deductionController.updateDeduction);
router.delete('/deductions/:id', auth, authorize('canAddManualDeduction', 'all'), deductionController.deleteDeduction);

// ═══════════════════════════════════════
// Payroll Routes
// ═══════════════════════════════════════
router.get('/payrolls', auth, payrollController.getPayrolls);
router.get('/payrolls/stats', auth, payrollController.getPayrollStats);
router.get('/payrolls/summary', auth, payrollController.getPayrollSummary);
router.get('/payrolls/employee/:employeeId', auth, payrollController.getEmployeePayrollHistory);
router.get('/payrolls/:id', auth, payrollController.getPayrollById);
router.post('/payrolls/generate', auth, authorize('canApproveAdvance', 'all'), payrollController.generatePayroll);
router.post('/payrolls/bulk-generate', auth, authorize('canApproveAdvance', 'all'), payrollController.bulkGeneratePayrolls);
router.put('/payrolls/:id/edit', auth, authorize('canApproveAdvance', 'all'), payrollController.editPayroll);
router.post('/payrolls/:id/recalculate', auth, authorize('canApproveAdvance', 'all'), payrollController.recalculatePayroll);
router.post('/payrolls/:id/approve', auth, authorize('canApproveAdvance', 'all'), payrollController.approvePayroll);
router.post('/payrolls/:id/pay', auth, authorize('canApproveAdvance', 'all'), payrollController.payPayroll);
router.post('/payrolls/:id/lock', auth, authorize('canApproveAdvance', 'all'), payrollController.lockPayroll);
router.post('/payrolls/:id/unlock', auth, authorize('canApproveAdvance', 'all'), payrollController.unlockPayroll);
router.post('/payrolls/:id/print', auth, payrollController.printPayroll);
router.delete('/payrolls/:id', auth, authorize('canApproveAdvance', 'all'), payrollController.deletePayroll);

// ═══════════════════════════════════════
// Payment Routes (NEW)
// ═══════════════════════════════════════
router.get('/payments', auth, paymentController.getPayments);
router.get('/payments/summary/:employeeId', auth, paymentController.getEmployeeSalarySummary);
router.post('/payments', auth, authorize('canApproveAdvance', 'all'), paymentController.makePayment);
router.put('/payments/:id', auth, authorize('canApproveAdvance', 'all'), paymentController.updatePayment);
router.delete('/payments/:id', auth, authorize('canApproveAdvance', 'all'), paymentController.deletePayment);

// ═══════════════════════════════════════
// Bonus Routes
// ═══════════════════════════════════════
router.get('/bonuses', auth, bonusController.getBonuses);
router.get('/bonuses/summary', auth, bonusController.getBonusSummary);
router.get('/bonuses/:employeeId/:month', auth, bonusController.getBonusesByMonth);
router.post('/bonuses', auth, authorize('canEditEmployee', 'all'), bonusController.createBonus);
router.put('/bonuses/:id', auth, authorize('canEditEmployee', 'all'), bonusController.updateBonus);
router.delete('/bonuses/:id', auth, authorize('canEditEmployee', 'all'), bonusController.deleteBonus);

export default router;
