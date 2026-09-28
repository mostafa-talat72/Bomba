/**
 * القاعدة المعتمدة الموحدة لحساب المرتبات (single source of truth).
 * كل محركات الحساب (كشف الراتب، الملخص، المدفوعات، الحضور) تستخدم هذه الدوال.
 *
 * 1) الأجر اليومي = الشهري ÷ 30 (عرف القطاع الخاص المصري).
 * 2) الأساسي الشهري كامل + خصم أيام الغياب غير المعذور × الأجر اليومي
 *    (نصف اليوم = نصف أجر). لا خصم تلقائي للتأخير كأيام — له بند دقائق مستقل.
 * 3) الإضافي = ساعات الإضافي × السعر الثابت overtimeHourlyRate، وعند غيابه
 *    يُشتق: (الشهري ÷ 30 ÷ 8) × معامل الإضافي (افتراضي 1.5).
 * 4) السلف: أقساط فقط min(amountPerMonth, remaining) وللمصروفة فعلاً (paid).
 * 5) الحضور/المتأخر = يوم كامل، نصف اليوم = 0.5.
 */

export const PAY_DAYS_DIVISOR = 30;
export const STANDARD_DAY_HOURS = 8;
export const DEFAULT_OVERTIME_MULTIPLIER = 1.5;

export function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

/** الأجر اليومي حسب نوع التوظيف */
export function dailyRateOf(compensation = {}, employmentType = 'monthly') {
    const comp = compensation || {};
    if (employmentType === 'daily') return num(comp.daily);
    if (employmentType === 'hourly') return num(comp.hourly) * STANDARD_DAY_HOURS;
    return num(comp.monthly) / PAY_DAYS_DIVISOR;
}

/** أيام العمل المحسوبة: حضور + تأخير + نصف × أيام النصف */
export function countWorkedDays({ present = 0, late = 0, halfDay = 0 } = {}) {
    return num(present) + num(late) + num(halfDay) * 0.5;
}

/** أيام الغياب المخصومة: غياب كامل + نصف × أيام النصف */
export function countAbsentDays({ absent = 0, halfDay = 0 } = {}) {
    return num(absent) + num(halfDay) * 0.5;
}

/** سعر ساعة الإضافي: الثابت أولاً ثم المشتق */
export function overtimeRateOf(compensation = {}, employmentType = 'monthly') {
    const comp = compensation || {};
    const flat = num(comp.overtimeHourlyRate);
    if (flat > 0) return flat;
    const mult = num(comp.overtimeRate) > 0 ? num(comp.overtimeRate) : DEFAULT_OVERTIME_MULTIPLIER;
    if (employmentType === 'daily') return (num(comp.daily) / STANDARD_DAY_HOURS) * mult;
    if (employmentType === 'hourly') return num(comp.hourly) * mult;
    return ((num(comp.monthly) / PAY_DAYS_DIVISOR) / STANDARD_DAY_HOURS) * mult;
}

/** هل السلفة مصروفة فعلاً (المعتمدة دون صرف لا تُخصم) */
export function isAdvanceDisbursed(adv) {
    return !!adv && adv.status === 'paid' && num(adv?.repayment?.remainingAmount) > 0;
}

/** قسط السلفة الشهري */
export function advanceInstallment(adv) {
    if (!isAdvanceDisbursed(adv)) return 0;
    return Math.min(num(adv.repayment.amountPerMonth), num(adv.repayment.remainingAmount));
}

/** التحقق من مبلغ الدفع */
export function validatePayAmount(amount, unpaidBalance) {
    const a = num(amount);
    const unpaid = num(unpaidBalance);
    if (!(a > 0)) return { ok: false, error: 'مبلغ الدفع يجب أن يكون أكبر من صفر' };
    if (a > unpaid) return { ok: false, error: `المبلغ يتجاوز المتبقي (${unpaid})` };
    return { ok: true, amount: a };
}
