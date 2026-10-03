import React from 'react';
import {
  X, DollarSign, Gamepad2, Receipt, CheckCircle,
  Table as TableIcon, QrCode, Printer,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Bill } from '../../services/api';
import { useOrganization } from '../../context/OrganizationContext';
import { formatDecimal, localeTag } from '../../utils/formatters';
import { printBill } from '../../utils/printBill';
import { resolveEffectivePrintSettings, resolveFulfillmentFlag } from '../../utils/resolvePrintSettings';
import { getFulfillmentFlagFresh } from '../../utils/freshPrintSettings';
import { aggregateItemsWithPayments } from '../../utils/billAggregation';
import { canPayFullBill, canDeleteBill, canEditPartialPayment, canMoveBillTableToTable } from '../../utils/permissionHelper';
import { getTableDisplay } from './tableHelpers';
import { paymentMethodLabel, paymentMethodIcon, PAYMENT_METHODS, type PaymentMethod } from '../../utils/paymentMethod';
import { drawerLabel, type CashDrawer } from '../../utils/paymentDrawer';
import { DrawerSelect } from '../ui/DrawerSelect';
import ModalPortal from '../ModalPortal';

interface PaymentManagementModalProps {
  isOpen: boolean;
  selectedBill: Bill | null;
  user: any;
  // حالة نموذج الدفع
  paymentAmount: string;
  setPaymentAmount: (v: string) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (m: PaymentMethod) => void;
  paymentDrawer: CashDrawer;
  setPaymentDrawer: (d: CashDrawer) => void;
  paymentReference: string;
  setPaymentReference: (v: string) => void;
  isProcessingPayment: boolean;
  // المعالجات
  handlePaymentSubmit: () => void | Promise<void>;
  handlePartialPayment: (bill: Bill) => void | Promise<void>;
  handleEndSession: (sessionId: string) => void;
  handleEditItemPayment: (data: any, index: number) => void;
  handleClosePaymentModal: () => void;
  setShowCancelConfirmModal: (v: boolean) => void;
  setShowChangeTableModal: (v: boolean) => void;
  setNewTableNumber: (v: any) => void;
  setShowSessionPaymentModal: (v: boolean) => void;
  setShowPaymentModal: (v: boolean) => void;
  setActiveTab: (tab: string) => void;
  setActiveTab3: (tab: string) => void;
  getSessionCost: (session: any) => number;
  formatCurrency: (amount: number) => string;
  showNotification: (msg: string, type?: string) => void;
  // التقريب التلقائي
  roundingLabel?: string;
  onToggleRounding?: () => void;
  applyRounding?: (v: number) => number;
  // الدفع المقسوم
  onSplitSubmit?: (amount2: string, method2: PaymentMethod) => Promise<void> | void;
  // طباعة + دفع كامل (اختياري من الأب)
  onPrintAndPayFull?: (bill: Bill, method: PaymentMethod) => Promise<void> | void;
  // للـ tick اللحظي كل 10 ثوانٍ
  tick?: number;
}

const PaymentManagementModal: React.FC<PaymentManagementModalProps> = ({
  isOpen,
  selectedBill,
  user,
  paymentAmount,
  setPaymentAmount,
  paymentMethod,
  setPaymentMethod,
  paymentDrawer,
  setPaymentDrawer,
  paymentReference,
  setPaymentReference,
  isProcessingPayment,
  handlePaymentSubmit,
  handlePartialPayment,
  handleEndSession,
  handleEditItemPayment,
  handleClosePaymentModal,
  setShowCancelConfirmModal,
  setShowChangeTableModal,
  setNewTableNumber,
  setShowSessionPaymentModal,
  setShowPaymentModal,
  setActiveTab,
  setActiveTab3,
  getSessionCost,
  formatCurrency,
  showNotification,
  roundingLabel,
  onToggleRounding,
  applyRounding,
  onSplitSubmit,
  onPrintAndPayFull,
  tick,
}) => {
  const { t, i18n } = useTranslation();
  const { formatDate } = useOrganization();

  // ── تبويبات النافذة (دفع / تفاصيل) ──
  const [payTab, setPayTab] = React.useState<'pay' | 'details'>('pay');

  // ── الدفع المقسوم ──
  const [splitEnabled, setSplitEnabled] = React.useState(false);
  const [splitAmount2, setSplitAmount2] = React.useState('');
  const [splitMethod2, setSplitMethod2] = React.useState<PaymentMethod>('card');

  // إعادة ضبط التقسيم عند تغيير الفاتورة
  React.useEffect(() => { setSplitEnabled(false); setSplitAmount2(''); setSplitMethod2('card'); }, [selectedBill?._id, selectedBill?.id]);

  // تأكيد الدفع: مراجعة المبلغ والطريقة قبل التنفيذ (يعمل في كل الصفحات).
  const [confirmPay, setConfirmPay] = React.useState<null | { mode: 'submit' | 'split' }>(null);
  React.useEffect(() => { setConfirmPay(null); }, [selectedBill?._id, selectedBill?.id, isOpen]);
  const methodLabel = (m: string) => paymentMethodLabel(m, t);
  const confirmAmount = confirmPay?.mode === 'split'
    ? (parseFloat(paymentAmount) || 0) + (parseFloat(splitAmount2) || 0)
    : parseFloat(paymentAmount) || 0;
  const confirmMethodText = confirmPay?.mode === 'split'
    ? `${methodLabel(paymentMethod)} + ${methodLabel(splitMethod2)} · ${drawerLabel(paymentDrawer, t)}`
    : `${methodLabel(paymentMethod)} · ${drawerLabel(paymentDrawer, t)}`;
  const openPayConfirm = () => {
    if (hasActiveSession(selectedBill) || isProcessingPayment) return;
    // الدفع الكامل له نافذته الخاصة في Tables (payFullBillConfirm) — لا نضاعف التأكيد
    const isFullPayment = parseFloat(paymentAmount) >= (selectedBill?.remaining || 0);
    if (!splitEnabled && isFullPayment) {
      void handlePaymentSubmit();
      return;
    }
    if (splitEnabled) {
      if (!onSplitSubmit || !splitAmount2) return;
      // الجزء الثاني يُدخل يدويًا — والجزء الأول = المتبقي − الثاني تلقائيًا
      // (وإلا جُمع الثاني فوق الإجمالي الكامل كما كان يحدث)
      const rem = Number(selectedBill?.remaining) || 0;
      const a2 = parseFloat(splitAmount2);
      if (isNaN(a2) || a2 <= 0 || a2 >= rem) {
        showNotification(t('billing.notifications.invalidAmount'), 'error');
        return;
      }
      const a1cur = parseFloat(paymentAmount);
      if (isNaN(a1cur) || a1cur >= rem - 0.011) {
        setPaymentAmount(String(Math.round((rem - a2) * 100) / 100));
      } else if (a1cur + a2 - rem > 0.011) {
        showNotification(t('billing.notifications.invalidAmount'), 'error');
        return;
      }
      setConfirmPay({ mode: 'split' });
    } else {
      if (!paymentAmount) return;
      setConfirmPay({ mode: 'submit' });
    }
  };
  const execConfirmedPay = async () => {
    const mode = confirmPay?.mode;
    setConfirmPay(null);
    try {
      if (mode === 'split') await onSplitSubmit?.(splitAmount2, splitMethod2);
      else await handlePaymentSubmit();
    } catch (e) { console.error(e); }
  };

  // الدفع بالكامل عند الطباعة — حسب نوع الفاتورة (طاولة/تيك أوي/دليفري).
  // ملاحظة: user.organization لقطة من تسجيل الدخول وقد تكون قديمة بعد حفظ
  // الإعدادات — فنقرأ القيمة الطازجة من السيرفر عند فتح النافذة (مع الذاكرة كبديل فوري).
  const billFulfillmentKind = (selectedBill as any)?.fulfillmentType as string | undefined;
  const memoryPayOnPrint = resolveFulfillmentFlag(resolveEffectivePrintSettings(user, (user as any)?.organization), 'printMarksPaid', billFulfillmentKind, false) === true;
  const [payOnPrintFresh, setPayOnPrintFresh] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setPayOnPrintFresh(null);
    getFulfillmentFlagFresh(user, 'printMarksPaid', billFulfillmentKind, false)
      .then((v) => { if (!cancelled) setPayOnPrintFresh(v); })
      .catch(() => { if (!cancelled) setPayOnPrintFresh(false); });
    return () => { cancelled = true; };
  }, [isOpen, (selectedBill as any)?._id || (selectedBill as any)?.id, billFulfillmentKind]);
  const shouldPayOnPrint = (payOnPrintFresh ?? memoryPayOnPrint) === true;
  const [printing, setPrinting] = React.useState(false);
  const handlePrintClick = async () => {
    if (!selectedBill) return;
    if (shouldPayOnPrint && selectedBill.status !== 'paid' && onPrintAndPayFull) {
      if (!canPayFullBill(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
      setPrinting(true);
      try { await onPrintAndPayFull(selectedBill, paymentMethod); }
      catch (e) { console.error(e); }
      finally { setPrinting(false); }
      return;
    }
    setPrinting(true);
    try {
      const ok = await printBill(selectedBill, user?.organizationName, i18n.language, t);
      if (!ok) showNotification(t('billing.printFailed'), 'error');
    } catch (e) {
      console.error(e);
      showNotification(t('billing.printFailed'), 'error');
    } finally { setPrinting(false); }
  };

  const roundFn = applyRounding || ((v: number) => v);

  const submitSplit = async () => {
    if (!onSplitSubmit) return;
    const a1 = parseFloat(paymentAmount);
    const a2 = parseFloat(splitAmount2);
    if (isNaN(a1) || isNaN(a2) || a1 <= 0 || a2 <= 0) {
      showNotification(t('billing.notifications.invalidAmount'), 'error'); return;
    }
    if (paymentMethod === splitMethod2) {
      showNotification(t('billing.splitPayDifferentMethods'), 'error'); return;
    }
    await onSplitSubmit(splitAmount2, splitMethod2);
  };

  // تجميع الأصناف مع الدفعات مرة واحدة (كان يُحسب مرتين) — قبل early return لتجنب خرق Rules of Hooks
  const aggregatedItems = React.useMemo(
    () => {
      if (!selectedBill) return [] as ReturnType<typeof aggregateItemsWithPayments>;
      return aggregateItemsWithPayments(selectedBill.orders || [], selectedBill.itemPayments || [], selectedBill.status, selectedBill.paid, selectedBill.total);
    },
    [selectedBill?.orders, selectedBill?.itemPayments, selectedBill?.status, selectedBill?.paid, selectedBill?.total]
  );

  if (!isOpen || !selectedBill) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'partial': return 'bg-yellow-100 text-yellow-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => t(`billing.status.${status}`) || status;

  const getCustomerDisplay = (bill: Bill | null | undefined) => {
    if (!bill || !bill.customerName) return t('billing.defaultCustomer');
    const m = bill.customerName.match(/^(?:طاولة|Table|table)\s+(\d+)$/i);
    if (m) return t('billing.tableWithNumber', { number: m[1] });
    return bill.customerName;
  };

  const hasActiveSession = (bill: Bill | null | undefined) =>
    bill?.sessions?.some((s: any) => (typeof s === 'object' ? s.status : null) === 'active') || false;

  void tick; // يعيد الحساب كل 10 ثوانٍ للجلسات النشطة

  return (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 z-[300]">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
            style={{ height: 'min(96vh, 820px)', maxWidth: '1100px' }}
            onClick={e => e.stopPropagation()}>

            {/* ══ HEADER ══ */}
            <div className="flex-shrink-0 bg-gradient-to-l from-blue-700 to-indigo-800 px-5 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/20">
                  <DollarSign className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-white leading-tight">{t('billing.paymentManagementTitle')}</h3>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-sm text-blue-200">{t('payment.invoice', { number: selectedBill?.billNumber || (selectedBill?.id || selectedBill?._id)?.toString().slice(-6) })}</span>
                    {(() => {
                      const ft = (selectedBill as any)?.fulfillmentType || 'dine_in';
                      const label = ft === 'delivery' ? `🛵 ${t('payment.billKindDelivery', 'دليفري')}` : ft === 'takeaway' ? `🥡 ${t('payment.billKindTakeaway', 'تيك أوي')}` : `🍽 ${t('payment.billKindDineIn', 'صالة')}`;
                      return <span className="text-sm px-2 py-0.5 rounded-full font-bold bg-white/15 text-white border border-white/20">{label}</span>;
                    })()}
                    {selectedBill?.table && <span className="text-sm text-blue-200">{t('payment.tableLine', { number: getTableDisplay((selectedBill.table as any).number, i18n.language) })}</span>}
                    <span className={`text-sm px-2 py-0.5 rounded-full font-bold ${getStatusColor(selectedBill.status)}`}>{getStatusText(selectedBill.status)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {selectedBill?.table && (
                  <button onClick={() => { setShowPaymentModal(false); setActiveTab3('orders'); setActiveTab('orders'); }}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-white text-sm font-medium transition-all border border-white/20">
                    <TableIcon className="h-3.5 w-3.5" />{t('payment.tableButton')}
                  </button>
                )}
                <button onClick={handleClosePaymentModal}
                  className="w-8 h-8 bg-white/15 hover:bg-white/25 rounded-lg flex items-center justify-center text-white/80 hover:text-white transition-all border border-white/20">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* ══ إجماليات ثابتة: قسمان — المبالغ + طريقة الدفع ══ */}
            <div className="flex-shrink-0 px-3 sm:px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-700/60 flex flex-col gap-2">
              {/* ── قسم 1: المبالغ ── */}
              <div>
                <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />{t('payment.amountsSection', 'المبالغ')}
                </p>
                {(() => {
                  const totalFD = (selectedBill?.orders || []).reduce((sum: number, o: any) => sum + (Number(o?.fixedDiscount?.amount) || 0), 0);
                  const totalOrderDiscounts = (selectedBill?.orders || []).reduce((sum: number, o: any) => sum + (Number(o?.discount) || 0), 0);
                  const billDiscount = Number(selectedBill?.discount) || 0;
                  const totalAllDiscounts = totalFD + totalOrderDiscounts + billDiscount;
                  const netTotal = Number(selectedBill?.total) || 0;
                  const beforeTotal = netTotal + totalAllDiscounts;
                  const paidTotal = Number(selectedBill?.paid) || 0;
                  const remTotal = Number(selectedBill?.remaining) || 0;
                  const cards = [
                    ...(totalAllDiscounts > 0 ? [
                      { label: t('payment.beforeDiscount', 'قبل الخصم'), value: beforeTotal, cls: 'text-gray-500 dark:text-gray-400 line-through', bg: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700' },
                      { label: t('payment.discountAmount', 'الخصم'), value: totalAllDiscounts, prefix: '-', cls: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/60' },
                    ] : []),
                    { label: t('billing.totalAmount'), value: netTotal, cls: 'text-gray-800 dark:text-gray-100', bg: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700' },
                    { label: t('billing.paidPreviously'), value: paidTotal, cls: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/60' },
                    { label: t('billing.remaining'), value: remTotal,
                      cls: remTotal > 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400',
                      bg: remTotal > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/60' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/60' },
                  ];
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
                      {cards.map(item => (
                        <div key={item.label} className={`${item.bg} border rounded-xl px-2 sm:px-3 py-1.5 text-center min-w-0`}>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5 truncate">{item.label}</p>
                          <p className={`text-base sm:text-lg font-bold truncate ${item.cls}`}>{(item as any).prefix || ''}{formatCurrency(item.value)}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {/* مؤشر التقريب التلقائي */}
                  {onToggleRounding && (
                    <button onClick={onToggleRounding}
                      title={t('payment.roundingTitle')}
                      className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-[11px] font-bold transition-all border flex-shrink-0 ${
                        roundingLabel && roundingLabel !== t('payment.noRounding')
                          ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400'
                      }`}>
                      ≈ {roundingLabel || t('payment.noRounding')}
                    </button>
                  )}
                  {selectedBill?.table && canMoveBillTableToTable(user) && (
                    <button onClick={() => { setNewTableNumber((selectedBill.table as any)?._id || null); setShowChangeTableModal(true); }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-xl text-amber-600 dark:text-amber-400 text-sm font-bold transition-all border border-amber-200 dark:border-amber-700 flex-shrink-0">
                      <TableIcon className="h-3.5 w-3.5" />{t('billing.changeTable')}
                    </button>
                  )}
                </div>
              </div>
              {/* ── قسم 2: طريقة الدفع ── */}
              {selectedBill?.status !== 'paid' && (
                <div>
                  <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />{t('payment.methodSection', 'طريقة الدفع')}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {PAYMENT_METHODS.map(m => (
                      <button key={m} onClick={() => setPaymentMethod(m)}
                        className={`py-2 rounded-xl border-2 text-center text-sm font-bold transition-all ${
                          paymentMethod === m ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-300'
                        }`}>
                        <div className="text-lg mb-0.5">{paymentMethodIcon(m)}</div>
                        {methodLabel(m)}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2">
                    <DrawerSelect
                      value={paymentDrawer}
                      onChange={setPaymentDrawer}
                      className="w-full"
                      showLabels={true}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Mobile tabs: pay | details */}
            <div className="lg:hidden flex-shrink-0 grid grid-cols-2 gap-1 p-1.5 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setPayTab('pay')}
                className={`py-2 rounded-lg text-sm font-bold transition-all ${payTab === 'pay' ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 shadow' : 'text-gray-500 dark:text-gray-400'}`}
              >
                {t('payment.payTab')}
              </button>
              <button
                type="button"
                onClick={() => setPayTab('details')}
                className={`py-2 rounded-lg text-sm font-bold transition-all ${payTab === 'details' ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 shadow' : 'text-gray-500 dark:text-gray-400'}`}
              >
                {t('payment.detailsTab')}
              </button>
            </div>

            {/* ══ BODY: 4 أعمدة ══ */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden min-h-0">

              {/* ══ عمود 1: خيارات الدفع + الجلسات النشطة ══ */}
              <div className={`flex-col min-h-0 border-l border-gray-100 dark:border-gray-700/60 w-full lg:w-[320px] flex-shrink-0 ${payTab === 'pay' ? 'flex' : 'hidden'} lg:flex`}>
                <div className="flex-shrink-0 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 border-b border-gray-100 dark:border-gray-700/60">
                    <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />{t('payment.payOptions')}
                    </p>
                </div>
                <div className="lg:flex-1 lg:overflow-y-auto flex flex-col lg:min-h-0">
                  <div className="p-3 flex flex-col gap-2 flex-1">

                    {selectedBill?.status !== 'paid' ? (<>
                      {/* أزرار الخيارات */}
                      <div className="flex flex-col gap-2">
                        {[
                          {
                            emoji: '💰', title: t('billing.payFullBillOption'),
                            sub: selectedBill?.remaining ? formatCurrency(selectedBill.remaining) : '',
                            disabled: hasActiveSession(selectedBill),
                            onClick: () => {
                              if (!canPayFullBill(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
                              if (selectedBill?.remaining) {
                                setPaymentAmount(selectedBill.remaining.toString());
                                setPaymentMethod('cash'); setPaymentReference('');
                              }
                            },
                          },
                          { emoji: '🍹', title: t('billing.paySpecificItem'), sub: '', disabled: false, onClick: async () => { if (selectedBill) await handlePartialPayment(selectedBill); } },
                          ...(selectedBill?.sessions && selectedBill.sessions.length > 0
                            ? [{ emoji: '🎮', title: t('billing.partialPaymentForSessions'), sub: '', disabled: false, onClick: () => setShowSessionPaymentModal(true) }]
                            : []),
                        ].map(opt => (
                          <button key={opt.title} onClick={opt.onClick} disabled={opt.disabled}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-right w-full transition-all ${
                              opt.disabled
                                ? 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-400 cursor-not-allowed opacity-60'
                                : 'border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md'
                            }`}>
                            <span className="text-2xl flex-shrink-0">{opt.emoji}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-gray-800 dark:text-gray-100 leading-tight">{opt.title}</p>
                              {opt.sub && <p className="text-[11px] text-gray-500 mt-0.5">{opt.sub}</p>}
                              {opt.disabled && <p className="text-[11px] text-red-500 mt-0.5">{t('billing.unavailableActiveSession')}</p>}
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* حقول الدفع */}
                      {paymentAmount && (
                        <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 border border-gray-200 dark:border-gray-700 space-y-2.5 mt-1">
                          <div>
                            <label className="text-sm font-semibold text-gray-500 dark:text-gray-400 block mb-1">{t('billing.paymentAmount')}</label>
                            <input type="text" value={formatCurrency(parseFloat(paymentAmount))}
                              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-bold" disabled />
                          </div>
                          {/* طريقة الدفع والدرج مختارة من قسم طريقة الدفع بالأعلى */}
                          {/* دفع مقسوم — طريقتان */}
                          {onSplitSubmit && selectedBill && !(['paid'] as string[]).includes(selectedBill.status) && (
                            <div className="pt-0.5">
                              <button onClick={() => setSplitEnabled(v => !v)}
                                className={`w-full py-1.5 rounded-lg text-[11px] font-bold border transition-all flex items-center justify-center gap-1.5 ${
                                  splitEnabled
                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                                    : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-indigo-300'
                                }`}>
                                {t('payment.splitTitle')} {splitEnabled ? '✓' : ''}
                              </button>
                              {splitEnabled && (
                                <div className="mt-1.5 grid grid-cols-[1fr_88px] gap-1.5 items-center bg-indigo-50/60 dark:bg-indigo-900/20 rounded-lg p-2 border border-indigo-100 dark:border-indigo-800">
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                                      {t('payment.splitPart1', { amount: formatCurrency(parseFloat(paymentAmount) || 0), method: paymentMethodLabel(paymentMethod, t) })}<br />
                                      {t('payment.splitPart2')}
                                    </p>
                                  <input type="number" min="0" step="0.01" value={splitAmount2}
                                    onChange={e => setSplitAmount2(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-indigo-500" />
                                  <div className="col-span-2 grid grid-cols-3 gap-1">
                                    {PAYMENT_METHODS.filter(m => m !== paymentMethod).map(m => (
                                      <button key={m} onClick={() => setSplitMethod2(m)}
                                        className={`py-1 rounded-md border text-[10px] font-bold transition-all ${
                                          splitMethod2 === m ? 'border-indigo-500 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'border-gray-200 dark:border-gray-600 text-gray-500'
                                        }`}>
                                        {paymentMethodIcon(m)} {methodLabel(m)}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          {(() => {
                            const effTotal = selectedBill.total || 0;
                            const newPaid  = (selectedBill.paid || 0) + parseFloat(paymentAmount);
                            const willPaid = newPaid >= effTotal;
                            return (
                              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${willPaid ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'}`}>
                                <span>{willPaid ? '✅' : '💰'}</span>
                                <p className={`text-sm font-bold ${willPaid ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                                  {willPaid ? t('billing.remainingWillBeZero') : t('billing.remainingWillBe', { amount: formatCurrency(Math.max(0, effTotal - newPaid)) })}
                                </p>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                    </>) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                        <div className="text-4xl mb-2">✅</div>
                        <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">{t('billing.billFullyPaidMessage')}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* footer */}
                <div className="sticky bottom-0 z-10 flex-shrink-0 px-3 py-2.5 border-t border-gray-100 dark:border-gray-700/60 bg-white dark:bg-gray-900 flex items-center justify-between gap-2">
                  {selectedBill?.status !== 'paid' ? (
                    <button onClick={() => { if (!canDeleteBill(user)) { showNotification(t('common.permissionDenied'), 'error'); return; } setShowCancelConfirmModal(true); }}
                      className="px-3 py-1.5 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 rounded-lg text-sm font-medium transition-all border border-red-100 dark:border-red-800/50">
                      {t('billing.deleteBill')}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span className="text-sm font-medium">{t('billing.billFullyPaid')}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <button onClick={handleClosePaymentModal}
                      className="px-3 py-1.5 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg text-sm font-medium transition-all">
                      {t('common.close')}
                    </button>
                    {selectedBill?.status !== 'paid' && paymentAmount && (
                      <button onClick={openPayConfirm}
                        disabled={hasActiveSession(selectedBill) || isProcessingPayment || (splitEnabled && !splitAmount2)}
                        className={`px-4 py-1.5 rounded-lg text-base font-bold transition-all flex items-center gap-1.5 ${
                          hasActiveSession(selectedBill) || isProcessingPayment || (splitEnabled && !splitAmount2)
                            ? 'bg-gray-300 dark:bg-gray-600 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-sm'
                        }`}>
                        {isProcessingPayment
                          ? <><svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>{t('payment.paying')}</>
                          : <><DollarSign className="h-3.5 w-3.5" />{splitEnabled ? t('payment.confirmPays') : t('payment.confirmPay')}</>
                        }
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ══ عمود 2: تفاصيل الأصناف ↕ الدفعات السابقة ══ */}
              <div className={`flex-col min-h-0 border-l border-gray-100 dark:border-gray-700/60 overflow-hidden w-full lg:w-[240px] flex-shrink-0 ${payTab === 'details' ? 'flex' : 'hidden'} lg:flex`}>

                {/* ── الأصناف (نصف علوي) ── */}
                <div className="flex flex-col min-h-0 lg:flex-1">
                  <div className="flex-shrink-0 px-3 py-1.5 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-700/60">
                    <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      <Receipt className="h-3 w-3" />{t('billing.itemDetails')}
                      {(selectedBill?.orders?.length || 0) > 0 && (
                        <span className="mr-auto bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-bold rounded-full px-1.5 leading-5">
                          {aggregatedItems.length}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="lg:flex-1 lg:overflow-y-auto overflow-visible p-2 space-y-1.5 lg:min-h-0 max-h-[35vh] lg:max-h-none">
                    {(selectedBill?.orders?.length || 0) === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-gray-600">
                          <Receipt className="h-6 w-6 mb-1 opacity-40" /><p className="text-[10px]">{t('payment.noItems')}</p>
                        </div>
                    ) : aggregatedItems.map((item, i) => (
                      <div key={i} className="bg-white dark:bg-gray-800 rounded-lg px-2.5 py-2 border border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight flex-1 min-w-0 flex items-center gap-1 flex-wrap">
                          <span className="truncate">{item.name}</span>
                          {(item as any).variant && <span className="text-[11px] bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-md font-bold whitespace-nowrap">{(item as any).variant}</span>}
                        </p>
                        <span className="text-[11px] text-gray-500 flex-shrink-0">{formatCurrency(item.price)}</span>
                      </div>
                        <div className="grid grid-cols-3 gap-1 text-center">
                            {[
                              { label: t('payment.qtyLabel'), value: item.totalQuantity,     cls: 'text-gray-700 dark:text-gray-200' },
                              { label: t('payment.paidLabel'),  value: item.paidQuantity,      cls: 'text-emerald-600 dark:text-emerald-400' },
                              { label: t('payment.remLabel'),  value: item.remainingQuantity, cls: item.remainingQuantity > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600' },
                            ].map(f => (
                            <div key={f.label} className="bg-gray-50 dark:bg-gray-700/40 rounded px-1 py-0.5">
                              <p className="text-[9px] text-gray-400 leading-tight">{f.label}</p>
                              <p className={`text-sm font-bold leading-tight ${f.cls}`}>{f.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* فاصل */}
                <div className="flex-shrink-0 h-px bg-gray-200 dark:bg-gray-700" />

                {/* ── الدفعات السابقة (نصف سفلي) ── */}
                <div className="flex flex-col min-h-0 lg:flex-1">
                  <div className="flex-shrink-0 px-3 py-1.5 bg-blue-50/60 dark:bg-blue-900/20 border-b border-gray-100 dark:border-gray-700/60">
                    <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />{t('billing.previousItemPayments')}
                      {(() => {
                        const c = (selectedBill?.itemPayments || []).reduce((s: number, ip: any) => s + (ip.paymentHistory?.length || 0), 0);
                        return c > 0 ? <span className="mr-auto bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200 text-[10px] font-bold rounded-full px-1.5 leading-5">{c}</span> : null;
                      })()}
                    </p>
                  </div>
                  <div className="lg:flex-1 lg:overflow-y-auto overflow-visible p-2 space-y-1.5 lg:min-h-0 max-h-[35vh] lg:max-h-none">
                    {(() => {
                      const allPmts: any[] = [];
                      (selectedBill?.itemPayments || []).forEach((ip: any) => {
                        ip.paymentHistory?.forEach((p: any, idx: number) => allPmts.push({ ip, p, idx }));
                      });
                      if (!allPmts.length) return (
                        <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-gray-600">
                          <DollarSign className="h-6 w-6 mb-1 opacity-40" /><p className="text-[10px]">{t('payment.noPayments')}</p>
                        </div>
                      );
                      return allPmts.map(({ ip, p, idx }, i) => (
                        <div key={i} className="bg-white dark:bg-gray-800 rounded-lg px-2.5 py-2 border border-blue-100 dark:border-blue-800/40 hover:border-blue-300 transition-colors">
                          <div className="flex items-start justify-between gap-1 mb-0.5">
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight flex-1 min-w-0 truncate">{ip.itemName || t('billing.unknownItem')}</p>
                            <p className="text-sm font-bold text-blue-700 dark:text-blue-300 flex-shrink-0">{formatCurrency(p.amount)}</p>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-gray-400 truncate flex-1">
                              {formatDecimal(p.quantity, i18n.language)} × {formatCurrency(ip.pricePerUnit)} · {p.method ? paymentMethodLabel(p.method, t) : paymentMethodLabel('cash', t)}
                            </p>
                            {canEditPartialPayment(user) && (
                              <button onClick={() => handleEditItemPayment({ itemPayment: ip, payment: p, paymentIdx: idx }, i)}
                                className="text-[11px] sm:text-[10px] text-blue-500 hover:text-blue-700 dark:text-blue-400 font-medium px-2 min-h-7 inline-flex items-center hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-all flex-shrink-0">
                                {t('common.edit')}
                              </button>
                            )}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>

              {/* ══ عمود 3: جميع الجلسات (نشطة + منتهية) ══ */}
              <div className={`flex-col min-h-0 border-l border-gray-100 dark:border-gray-700/60 overflow-hidden w-full lg:w-[220px] flex-shrink-0 ${payTab === 'details' ? 'flex' : 'hidden'} lg:flex`}>
                <div className="flex-shrink-0 px-3 py-1.5 bg-violet-50/60 dark:bg-violet-900/20 border-b border-gray-100 dark:border-gray-700/60">
                  <p className="text-[11px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-1">
                      <Gamepad2 className="h-3 w-3" />{t('payment.sessions')}
                    {(() => {
                      const all = selectedBill?.sessions?.length || 0;
                      const active = selectedBill?.sessions?.filter((s: any) => s.status === 'active').length || 0;
                      return all > 0 ? <span className="mr-auto text-[10px] font-bold rounded-full px-1.5 leading-5 bg-violet-200 dark:bg-violet-800 text-violet-700 dark:text-violet-200">{active}/{all}</span> : null;
                    })()}
                  </p>
                </div>
                <div className="lg:flex-1 lg:overflow-y-auto overflow-visible p-2 space-y-2 lg:min-h-0 max-h-[35vh] lg:max-h-none">
                  {(() => {
                    const allSess = selectedBill?.sessions || [];
                    if (!allSess.length) return (
                      <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-gray-600">
                        <Gamepad2 className="h-7 w-7 mb-1 opacity-40" />
                        <p className="text-[10px] text-center">{t('payment.noSessions')}</p>
                      </div>
                    );
                    return allSess.map((session: any, i: number) => {
                      void tick;
                      const isActive = session.status === 'active';
                      const startMs  = session.startTime ? new Date(session.startTime).getTime() : 0;
                      const endMs    = isActive ? Date.now() : (session.endTime ? new Date(session.endTime).getTime() : startMs);
                      const durMs    = Math.max(0, endMs - startMs);
                      const durH     = Math.floor(durMs / 3600000);
                      const durM     = Math.floor((durMs % 3600000) / 60000);
                      const durStr   = durH > 0 ? t('payment.durHm', { h: durH, m: durM }) : t('payment.durM', { m: durM });
                      const startStr = session.startTime ? new Date(session.startTime).toLocaleTimeString(localeTag(i18n.language), { hour: '2-digit', minute: '2-digit' }) : '—';
                      const sp = (selectedBill as any)?.sessionPayments?.find((p: any) =>
                        String(p.sessionId?._id || p.sessionId?.id || p.sessionId) === String(session._id || session.id)
                      );
                      const cost      = getSessionCost(session);
                      const recordedPaid = Array.isArray(sp?.payments)
                        ? sp.payments.reduce((sum: number, payment: any) => sum + (Number(payment?.amount) || 0), 0)
                        : 0;
                      const spPaid    = Math.min(cost, Math.max(Number(sp?.paidAmount) || 0, recordedPaid));
                      // للجلسة النشطة: المتبقي حي = التكلفة الحية - المدفوع (نتجاهل remainingAmount المخزن القديم)
                      const spRemain  = Math.max(0, cost - spPaid);
                      const icon      = session.deviceType === 'playstation' ? '🎮' : '💻';
                      return (
                        <div key={i} className={`bg-white dark:bg-gray-800 rounded-xl border overflow-hidden ${isActive ? 'border-emerald-200 dark:border-emerald-800/60' : 'border-gray-200 dark:border-gray-700 opacity-75'}`}>
                          {isActive ? (
                            <div className="h-0.5 bg-gradient-to-l from-emerald-400 to-green-500 animate-pulse" />
                          ) : (
                            <div className="h-0.5 bg-gray-200 dark:bg-gray-700" />
                          )}
                          <div className="px-2.5 py-2">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="text-xl">{icon}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-800 dark:text-gray-100 leading-tight truncate">{session.deviceName || t('payment.deviceFallback', { number: session.deviceNumber })}</p>
                                <p className={`text-[10px] ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                  {isActive ? t('payment.activeBadge') : t('payment.endedBadge')} · {durStr} · {startStr}
                                </p>
                              </div>
                            </div>
                            {session.controllers && (
                              <p className="text-[10px] text-gray-500 mb-1.5">{t('payment.controllersUnit', { count: session.controllers })}</p>
                            )}
                            <div className="grid grid-cols-3 gap-1 text-center mb-2">
                              {[
                                { label: t('payment.totalLabel'), value: formatCurrency(cost),     cls: 'text-gray-700 dark:text-gray-200' },
                                { label: t('payment.paidLabel2'),   value: formatCurrency(spPaid),   cls: 'text-emerald-600 dark:text-emerald-400' },
                                { label: t('payment.remLabel2'),   value: formatCurrency(spRemain), cls: spRemain > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600' },
                              ].map(f => (
                                <div key={f.label} className="bg-gray-50 dark:bg-gray-700/40 rounded px-1 py-0.5">
                                  <p className="text-[9px] text-gray-400 leading-tight">{f.label}</p>
                                  <p className={`text-[10px] font-bold leading-tight ${f.cls}`}>{f.value}</p>
                                </div>
                              ))}
                            </div>
                            {isActive ? (
                              <button onClick={() => handleEndSession(session._id || session.id)}
                                className="w-full min-h-8 py-1 bg-red-500 hover:bg-red-600 active:scale-95 text-white text-xs sm:text-[11px] font-bold rounded-lg transition-all">
                                {t('payment.endSession')}
                              </button>
                            ) : (
                              <div className="w-full py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[11px] font-bold rounded-lg text-center">
                                {t('payment.ended')}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* ══ عمود 4: QR + ملخص ══ */}
              <div className={`flex-col bg-gray-50 dark:bg-gray-800/40 lg:overflow-y-auto overflow-visible min-w-0 w-full lg:flex-1 lg:min-h-0 ${payTab === 'details' ? 'flex' : 'hidden'} lg:flex`}>
                <div className="p-3 space-y-3">
                  {/* QR */}
                  <div>
                    <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('billing.qrCodeForCustomer')}</p>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700 text-center">
                      {selectedBill?.qrCode ? (
                        <img src={selectedBill.qrCode} alt="QR" className="mx-auto w-28 h-28 object-contain" />
                      ) : (
                        <div className="w-28 h-28 mx-auto border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl flex items-center justify-center">
                          <QrCode className="h-9 w-9 text-gray-300 dark:text-gray-600" />
                        </div>
                      )}
                      {selectedBill?.status !== 'paid' && onPrintAndPayFull && shouldPayOnPrint && (
                        <p className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                          {t('payment.printPayFullNote')}
                        </p>
                      )}
                      <div className="flex gap-1.5 mt-2.5">
                        <button onClick={handlePrintClick} disabled={printing}
                          className="flex-1 min-h-9 py-1.5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs sm:text-[11px] font-medium rounded-lg flex items-center justify-center gap-1 transition-all disabled:opacity-50">
                          <Printer className="h-3 w-3" />{printing ? '...' : (shouldPayOnPrint && selectedBill?.status !== 'paid' && onPrintAndPayFull ? t('payment.printPayFull') : t('payment.print'))}
                        </button>
                        <button onClick={() => { const url = selectedBill?.qrCodeUrl || `${window.location.origin}/bill/${selectedBill?.id || selectedBill?._id}`; navigator.clipboard.writeText(url); showNotification(t('billing.linkCopied')); }}
                          className="flex-1 min-h-9 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs sm:text-[11px] font-medium rounded-lg transition-all">نسخ</button>
                      </div>
                    </div>
                  </div>
                  {/* ملخص */}
                  <div>
                    <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('billing.billSummary')}</p>
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                      {[
                        { label: t('billing.customer'),      value: getCustomerDisplay(selectedBill) },
                        { label: t('billing.ordersCount'),   value: `${selectedBill?.orders?.length || 0}` },
                        { label: t('billing.sessionsCount'), value: `${selectedBill?.sessions?.length || 0}${hasActiveSession(selectedBill) ? t('payment.activeSuffix') : ''}` },
                        { label: t('billing.creationDate'),  value: selectedBill?.createdAt ? formatDate(selectedBill.createdAt) : '-' },
                      ].map(row => (
                        <div key={row.label} className="flex items-start justify-between gap-2 px-3 py-1.5 text-sm">
                          <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">{row.label}</span>
                          <span className="font-semibold text-gray-800 dark:text-gray-100 text-right max-w-[170px] break-words">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* رابط */}
                  <div>
                    <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{t('billing.customerLink')}</p>
                    <div className="flex gap-1.5">
                      <input type="text" readOnly value={selectedBill?.qrCodeUrl || `${window.location.origin}/bill/${selectedBill?.id || selectedBill?._id}`}
                        className="flex-1 text-[10px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-gray-700 dark:text-gray-300 min-w-0" />
                      <button onClick={() => { const url = selectedBill?.qrCodeUrl || `${window.location.origin}/bill/${selectedBill?.id || selectedBill?._id}`; navigator.clipboard.writeText(url); showNotification(t('billing.linkCopied')); }}
                          className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] rounded-lg transition-all font-medium">{t('payment.copy')}</button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
        {/* نافذة تأكيد الدفع — مراجعة المبلغ والطريقة قبل التنفيذ */}
        {confirmPay && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 p-4" onClick={() => setConfirmPay(null)}>
            <div
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xs border border-gray-200 dark:border-gray-700 p-5 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-4xl mb-2">💵</div>
              <h4 className="text-lg font-extrabold text-gray-900 dark:text-gray-100 mb-1">{t('payment.confirmTitle')}</h4>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 my-2">
                {formatCurrency(confirmAmount)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {confirmMethodText}
                {selectedBill?.billNumber ? ` — ${selectedBill.billNumber}` : ''}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmPay(null)}
                  disabled={isProcessingPayment}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold"
                >
                  {t('payment.back')}
                </button>
                <button
                  onClick={execConfirmedPay}
                  disabled={isProcessingPayment}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50"
                >
                  {isProcessingPayment ? t('payment.confirming') : t('payment.confirm')}
                </button>
              </div>
            </div>
          </div>
        )}
        </ModalPortal>
  );
};

export default React.memo(PaymentManagementModal);
