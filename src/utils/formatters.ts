/**
 * تحويل الأرقام الإنجليزية إلى العربية
 */
const convertToArabicNumbers = (str: string): string => {
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return str.replace(/[0-9]/g, (match) => arabicNumbers[parseInt(match)]);
};

/**
 * تنسيق الأرقام العشرية - تظهر العلامة العشرية فقط إذا كانت موجودة
 * وإذا كانت موجودة تظهر رقمين فقط بعد العلامة العشرية
 * مع عرض الأرقام باللغة العربية
 */
export const formatDecimal = (value: number | string | null | undefined): string => {
    if (value === null || value === undefined || value === '') {
        return '٠';
    }

    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(numValue)) {
        return '٠';
    }

    // تحويل الرقم إلى رقمين عشريين
    const formatted = numValue.toFixed(2);

    // إزالة الأصفار غير الضرورية بعد العلامة العشرية
    const trimmed = formatted.replace(/\.?0+$/, '');

    // تحويل الأرقام إلى العربية
    return convertToArabicNumbers(trimmed);
};

/**
 * تنسيق الأرقام العشرية مع إضافة "ج.م" للعملة
 * مع عرض الأرقام باللغة العربية
 */
export const formatCurrency = (value: number | string | null | undefined): string => {
    const formatted = formatDecimal(value);
    return `${formatted} ج.م`;
};

/**
 * تنسيق الأرقام العشرية مع إضافة وحدة القياس
 * مع عرض الأرقام باللغة العربية
 */
export const formatQuantity = (value: number | string | null | undefined, unit: string = ''): string => {
    const formatted = formatDecimal(value);
    return unit ? `${formatted} ${unit}` : formatted;
};
