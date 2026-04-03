// معالج أخطاء مركزي للتطبيق
import { isValidErrorCode, getErrorMessageKey } from '../constants/errorCodes';

export interface AppError {
  type: 'network' | 'server' | 'auth' | 'validation' | 'unknown';
  message: string;
  code?: string;
  originalError?: any;
  statusCode?: number;
}

export class ErrorHandler {
  static handle(error: any): AppError {
    // خطأ في الشبكة (لا يوجد اتصال)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        type: 'network',
        message: 'لا يمكن الاتصال بالسيرفر. تأكد من أن السيرفر يعمل وأن لديك اتصال بالإنترنت.',
        code: 'NETWORK_ERROR',
        originalError: error,
      };
    }

    // خطأ في الاتصال (timeout أو abort)
    if (error.name === 'AbortError') {
      return {
        type: 'network',
        message: 'انتهت مهلة الاتصال بالسيرفر. يرجى المحاولة مرة أخرى.',
        code: 'NETWORK_ERROR',
        originalError: error,
      };
    }

    // خطأ في المصادقة - استخدام status code بدلاً من string matching
    if (error.statusCode === 401 || error.status === 401) {
      return {
        type: 'auth',
        message: error.message || 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.',
        code: error.code || 'SESSION_EXPIRED',
        originalError: error,
        statusCode: 401,
      };
    }

    // خطأ في الصلاحيات
    if (error.statusCode === 403 || error.status === 403) {
      return {
        type: 'auth',
        message: error.message || 'ليس لديك صلاحية للقيام بهذا الإجراء.',
        code: error.code || 'FORBIDDEN',
        originalError: error,
        statusCode: 403,
      };
    }

    // خطأ في التحقق من البيانات
    if (error.statusCode === 400 || error.statusCode === 422 || error.status === 400 || error.status === 422) {
      return {
        type: 'validation',
        message: error.message || 'البيانات المدخلة غير صحيحة.',
        code: error.code || 'VALIDATION_ERROR',
        originalError: error,
        statusCode: error.statusCode || error.status,
      };
    }

    // خطأ في السيرفر
    if ((error.statusCode && error.statusCode >= 500) || (error.status && error.status >= 500)) {
      return {
        type: 'server',
        message: error.message || 'حدث خطأ في السيرفر. يرجى المحاولة لاحقاً.',
        code: error.code || 'SERVER_ERROR',
        originalError: error,
        statusCode: error.statusCode || error.status,
      };
    }

    // خطأ غير معروف
    return {
      type: 'unknown',
      message: error.message || 'حدث خطأ غير متوقع.',
      code: error.code || 'UNKNOWN_ERROR',
      originalError: error,
    };
  }

  static getUserMessage(error: AppError, t?: (key: string) => string): string {
    // If translation function is provided and error has a valid code, use translation
    if (t && error.code && isValidErrorCode(error.code)) {
      return t(getErrorMessageKey(error.code));
    }
    // Otherwise return the message as-is
    return error.message;
  }

  static shouldRetry(error: AppError): boolean {
    // يمكن إعادة المحاولة في حالة أخطاء الشبكة أو السيرفر
    return error.type === 'network' || error.type === 'server';
  }

  static shouldLogout(error: AppError): boolean {
    // تسجيل الخروج في حالة انتهاء الجلسة (status code 401)
    return error.type === 'auth' && error.statusCode === 401;
  }
}

export default ErrorHandler;
