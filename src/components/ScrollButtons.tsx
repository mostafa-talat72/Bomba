import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';

interface ScrollButtonsProps {
  mainContentRef?: React.RefObject<HTMLElement>;
  hideButtons?: boolean;
}

const ScrollButtons: React.FC<ScrollButtonsProps> = ({ mainContentRef, hideButtons = false }) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [showTopButton, setShowTopButton] = useState(false);
  const [showBottomButton, setShowBottomButton] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const container = mainContentRef?.current;
      let scrollTop: number;
      let scrollHeight: number;
      let clientHeight: number;

      if (container) {
        // إذا كان هناك container محدد
        scrollTop = container.scrollTop;
        scrollHeight = container.scrollHeight;
        clientHeight = container.clientHeight;
      } else {
        // استخدام window
        scrollTop = window.pageYOffset;
        scrollHeight = document.documentElement.scrollHeight;
        clientHeight = window.innerHeight;
      }

      // إظهار زر الصعود للأعلى إذا كان المستخدم قد سجل أكثر من 300 بكسل
      setShowTopButton(scrollTop > 300);

      // إظهار زر النزول للأسفل إذا لم يكن المستخدم في نهاية الصفحة
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setShowBottomButton(!isAtBottom && scrollHeight > clientHeight);
    };

    const container = mainContentRef?.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }
    window.addEventListener('scroll', handleScroll);

    // فحص الحالة الأولية
    handleScroll();

    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
      window.removeEventListener('scroll', handleScroll);
    };
  }, [mainContentRef]);

  const scrollToTop = () => {
    const container = mainContentRef?.current;
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToBottom = () => {
    const container = mainContentRef?.current;
    let scrollHeight: number;
    let clientHeight: number;

    if (container) {
      scrollHeight = container.scrollHeight;
      clientHeight = container.clientHeight;
      container.scrollTo({ top: scrollHeight - clientHeight, behavior: 'smooth' });
    } else {
      scrollHeight = document.documentElement.scrollHeight;
      clientHeight = window.innerHeight;
      window.scrollTo({ top: scrollHeight - clientHeight, behavior: 'smooth' });
    }
  };

  // Don't show buttons if hideButtons is true
  if (hideButtons) {
    return null;
  }

  return (
    <>
      {/* حبة تنقل واحدة مدمجة (صعود/نزول) — متناسقة على كل الشاشات */}
      {(showTopButton || showBottomButton) && isPageVisible && (
        <div
          className={`fixed z-40 flex flex-col gap-1 rounded-full p-1 bg-white/90 dark:bg-gray-800/90 shadow-lg border border-gray-200 dark:border-gray-700 backdrop-blur-sm bottom-[max(1rem,env(safe-area-inset-bottom))] lg:bottom-6 ${
            isRTL
              ? 'left-3 lg:left-6'
              : 'right-3 lg:right-6'
          }`}
        >
      {showTopButton && (
        <button
          onClick={scrollToTop}
          className="w-10 h-10 flex items-center justify-center bg-orange-600 dark:bg-orange-700 text-white rounded-full hover:bg-orange-700 dark:hover:bg-orange-800 transition-all duration-200 sm:hover:scale-105 active:scale-95"
          title={t('common.scrollToTop')}
          aria-label={t('common.scrollToTop')}
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      )}
      {showBottomButton && (
        <button
          onClick={scrollToBottom}
          className="w-10 h-10 flex items-center justify-center bg-gray-600 dark:bg-gray-700 text-white rounded-full hover:bg-gray-700 dark:hover:bg-gray-800 transition-all duration-200 sm:hover:scale-105 active:scale-95"
          title={t('common.scrollToBottom')}
          aria-label={t('common.scrollToBottom')}
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      )}
        </div>
      )}
    </>
  );
};

export default ScrollButtons;
