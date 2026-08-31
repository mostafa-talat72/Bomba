/**
 * Occupied Tables Helper
 * الدوال المساعدة للتحقق من الطاولات المشغولة ومنع الخروج
 */

interface Table {
  _id?: string;
  id?: string;
  number?: number | string;
  name?: string;
  status?: 'empty' | 'occupied' | 'reserved' | 'dirty';
}

/**
 * التحقق من وجود طاولات مشغولة
 * @param tables - قائمة الطاولات
 * @returns عدد الطاولات المشغولة
 */
export const getOccupiedTablesCount = (tables: Table[] | null | undefined): number => {
  if (!tables || !Array.isArray(tables)) return 0;
  return tables.filter(t => t?.status === 'occupied').length;
};

/**
 * الحصول على أسماء الطاولات المشغولة
 * @param tables - قائمة الطاولات
 * @returns قائمة بأسماء/أرقام الطاولات المشغولة
 */
export const getOccupiedTablesNames = (tables: Table[] | null | undefined): string[] => {
  if (!tables || !Array.isArray(tables)) return [];
  return tables
    .filter(t => t?.status === 'occupied')
    .map(t => String(t?.name || t?.number || t?.id || 'Unknown'))
    .filter(Boolean);
};

/**
 * التحقق من إمكانية الخروج من التطبيق
 * @param tables - قائمة الطاولات
 * @returns true إذا كان يمكن الخروج بدون تحذير، false إذا كانت هناك طاولات مشغولة
 */
export const canSafelyLogout = (tables: Table[] | null | undefined): boolean => {
  return getOccupiedTablesCount(tables) === 0;
};

/**
 * رسالة التحذير عند وجود طاولات مشغولة
 * @param occupiedCount - عدد الطاولات المشغولة
 * @param occupiedNames - أسماء الطاولات المشغولة
 * @returns رسالة التحذير
 */
export const getOccupiedTablesWarningMessage = (
  occupiedCount: number,
  occupiedNames: string[],
  language: 'ar' | 'en' = 'ar'
): string => {
  if (occupiedCount === 0) return '';

  const namesText = occupiedNames.join('، ');

  if (language === 'ar') {
    return `⚠️ هناك ${occupiedCount} طاولة مشغولة (${namesText}). هل تريد فعلاً تسجيل الخروج/إغلاق التطبيق؟`;
  } else {
    return `⚠️ There are ${occupiedCount} occupied table(s) (${namesText}). Are you sure you want to logout/close the application?`;
  }
};

/**
 * رسالة التأكيد عند الموافقة على الخروج رغم وجود طاولات مشغولة
 * @param language - اللغة
 * @returns رسالة التأكيد
 */
export const getConfirmLogoutMessage = (language: 'ar' | 'en' = 'ar'): string => {
  if (language === 'ar') {
    return 'هل أنت متأكد من رغبتك في تسجيل الخروج؟ ستُفقد جميع الجلسات المشغولة على هذه الطاولات.';
  } else {
    return 'Are you sure you want to logout? All active sessions on these tables will be lost.';
  }
};
