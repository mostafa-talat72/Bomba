import express from 'express';
import { protect as auth } from '../middleware/auth.js';
import * as employeeController from '../controllers/employeeController.js';
import * as attendanceController from '../controllers/attendanceController.js';
import * as advanceController from '../controllers/advanceController.js';
import * as payrollController from '../controllers/payrollController.js';
import * as deductionController from '../controllers/deductionController.js';
import * as paymentController from '../controllers/paymentController.js';

const router = express.Router();

// ═══════════════════════════════════════
// Employee Routes
// ═══════════════════════════════════════
router.get('/employees', auth, employeeController.getEmployees);
router.get('/employees/stats', auth, employeeController.getEmployeeStats);
router.get('/employees/:id', auth, employeeController.getEmployeeById);
router.post('/employees', auth, employeeController.createEmployee);
router.put('/employees/:id', auth, employeeController.updateEmployee);
router.delete('/employees/:id', auth, employeeController.deleteEmployee);

// ═══════════════════════════════════════
// Attendance Routes
// ═══════════════════════════════════════
router.get('/attendance', auth, attendanceController.getAttendance);
router.get('/attendance/summary', auth, attendanceController.getAttendanceSummary);
router.get('/attendance/:employeeId/:month', auth, attendanceController.getAttendanceByMonth);
router.post('/attendance', auth, attendanceController.markAttendance);
router.post('/attendance/bulk', auth, attendanceController.bulkMarkAttendance);
router.put('/attendance/:id', auth, attendanceController.updateAttendance);
router.delete('/attendance/:id', auth, attendanceController.deleteAttendance);

// ═══════════════════════════════════════
// Advance Routes
// ═══════════════════════════════════════
router.get('/advances', auth, advanceController.getAdvances);
router.get('/advances/stats', auth, advanceController.getAdvanceStats);
router.get('/advances/:id', auth, advanceController.getAdvanceById);
router.get('/advances/employee/:employeeId/active', auth, advanceController.getActiveAdvances);
router.post('/advances', auth, advanceController.requestAdvance);
router.put('/advances/:id/status', auth, advanceController.updateAdvanceStatus);
router.put('/advances/:id', auth, advanceController.updateAdvance);
router.post('/advances/:id/disburse', auth, advanceController.disburseAdvance);
router.post('/advances/:id/deduction', auth, advanceController.recordAdvanceDeduction);
router.delete('/advances/:id', auth, advanceController.deleteAdvance);

// ═══════════════════════════════════════
// Deduction Routes
// ═══════════════════════════════════════
router.get('/deductions', auth, deductionController.getDeductions);
router.post('/deductions', auth, deductionController.createDeduction);
router.put('/deductions/:id', auth, deductionController.updateDeduction);
router.delete('/deductions/:id', auth, deductionController.deleteDeduction);

// ═══════════════════════════════════════
// Payroll Routes
// ═══════════════════════════════════════
router.get('/payrolls', auth, payrollController.getPayrolls);
router.get('/payrolls/stats', auth, payrollController.getPayrollStats);
router.get('/payrolls/summary', auth, payrollController.getPayrollSummary);
router.get('/payrolls/employee/:employeeId', auth, payrollController.getEmployeePayrollHistory);
router.get('/payrolls/:id', auth, payrollController.getPayrollById);
router.post('/payrolls/generate', auth, payrollController.generatePayroll);
router.post('/payrolls/bulk-generate', auth, payrollController.bulkGeneratePayrolls);
router.put('/payrolls/:id/edit', auth, payrollController.editPayroll);
router.post('/payrolls/:id/approve', auth, payrollController.approvePayroll);
router.post('/payrolls/:id/pay', auth, payrollController.payPayroll);
router.post('/payrolls/:id/lock', auth, payrollController.lockPayroll);
router.post('/payrolls/:id/unlock', auth, payrollController.unlockPayroll);
router.post('/payrolls/:id/print', auth, payrollController.printPayroll);
router.delete('/payrolls/:id', auth, payrollController.deletePayroll);

// ═══════════════════════════════════════
// Payment Routes (NEW)
// ═══════════════════════════════════════
router.get('/payments', auth, paymentController.getPayments);
router.get('/payments/summary/:employeeId', auth, paymentController.getEmployeeSalarySummary);
router.post('/payments', auth, paymentController.makePayment);
router.put('/payments/:id', auth, paymentController.updatePayment);
router.delete('/payments/:id', auth, paymentController.deletePayment);

export default router;
