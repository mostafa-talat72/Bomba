// معالج أخطاء مركزي للتطبيق

export interface AppError {
  type: 'network' | 'server' | 'auth' | 'validation' | 'unknown';
  message: string;
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
        originalError: error,
      };
    }

    // خطأ في الاتصال (timeout أو abort)
    if (error.name === 'AbortError') {
      return {
        type: 'network',
        message: 'انتهت مهلة الاتصال بالسيرفر. يرجى المحاولة مرة أخرى.',
        originalError: error,
      };
    }

    // خطأ في المصادقة
    if (error.statusCode === 401 || error.message?.includes('انتهت صلاحية')) {
      return {
        type: 'auth',
        message: 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.',
        originalError: error,
        statusCode: 401,
      };
    }

    // خطأ في الصلاحيات
    if (error.statusCode === 403) {
      return {
        type: 'auth',
        message: 'ليس لديك صلاحية للقيام بهذا الإجراء.',
        originalError: error,
        statusCode: 403,
      };
    }

    // خطأ في التحقق من البيانات
    if (error.statusCode === 400 || error.statusCode === 422) {
      return {
        type: 'validation',
        message: error.message || 'البيانات المدخلة غير صحيحة.',
        originalError: error,
        statusCode: error.statusCode,
      };
    }

    // خطأ في السيرفر
    if (error.statusCode && error.statusCode >= 500) {
      return {
        type: 'server',
        message: 'حدث خطأ في السيرفر. يرجى المحاولة لاحقاً.',
        originalError: error,
        statusCode: error.statusCode,
      };
    }

    // خطأ غير معروف
    return {
      type: 'unknown',
      message: error.message || 'حدث خطأ غير متوقع.',
      originalError: error,
    };
  }

  static getUserMessage(error: AppError): string {
    return error.message;
  }

  static shouldRetry(error: AppError): boolean {
    // يمكن إعادة المحاولة في حالة أخطاء الشبكة أو السيرفر
    return error.type === 'network' || error.type === 'server';
  }

  static shouldLogout(error: AppError): boolean {
    // تسجيل الخروج في حالة انتهاء الجلسة
    return error.type === 'auth' && error.statusCode === 401;
  }
}

export default ErrorHandler;
