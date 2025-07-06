import express from 'express';
import {
  getBills,
  getBill,
  createBill,
  updateBill,
  addPayment,
  addOrderToBill,
  addSessionToBill,
  getBillByQR,
  cancelBill
} from '../controllers/billingController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public routes for customer access
router.get('/qr/:billId', getBillByQR);
router.get('/public/:id', getBill); // Route للعملاء بدون authentication

// All other routes require authentication
router.use(protect);

router.route('/')
  .get(authorize('billing', 'all'), getBills)
  .post(authorize('billing', 'all'), createBill);

router.route('/:id')
  .get(authorize('billing', 'all'), getBill)
  .put(authorize('billing', 'all'), updateBill);

router.post('/:id/payment', authorize('billing', 'all'), addPayment);
router.put('/:id/payment', authorize('billing', 'all'), addPayment);
router.post('/:id/orders', authorize('billing', 'all'), addOrderToBill);
router.post('/:id/sessions', authorize('billing', 'all'), addSessionToBill);
router.put('/:id/cancel', authorize('billing', 'all'), cancelBill);

export default router;
