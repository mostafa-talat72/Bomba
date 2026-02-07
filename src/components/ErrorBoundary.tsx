import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
            {/* أيقونة */}
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-12 h-12 text-red-600 dark:text-red-400" />
            </div>

            {/* العنوان */}
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 text-center mb-4">
              عذراً، حدث خطأ غير متوقع
            </h1>

            {/* الوصف */}
            <p className="text-gray-600 dark:text-gray-300 text-center mb-6 leading-relaxed">
              نعتذر عن هذا الإزعاج. حدث خطأ في التطبيق ولم نتمكن من معالجته.
              يرجى إعادة تحميل الصفحة أو العودة للصفحة الرئيسية.
            </p>

            {/* تفاصيل الخطأ (في وضع التطوير فقط) */}
            {import.meta.env.DEV && this.state.error && (
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mb-6 text-right">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">
                  تفاصيل الخطأ (وضع التطوير):
                </h3>
                <pre className="text-xs text-red-600 dark:text-red-400 overflow-auto max-h-40 whitespace-pre-wrap">
                  {this.state.error.toString()}
                  {this.state.errorInfo && (
                    <>
                      {'\n\n'}
                      {this.state.errorInfo.componentStack}
                    </>
                  )}
                </pre>
              </div>
            )}

            {/* الأزرار */}
            <div className="flex gap-4">
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
                إعادة تحميل الصفحة
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-medium transition-colors"
              >
                <Home className="w-5 h-5" />
                الصفحة الرئيسية
              </button>
            </div>

            {/* معلومات إضافية */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                إذا استمرت المشكلة، يرجى التواصل مع الدعم الفني
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
