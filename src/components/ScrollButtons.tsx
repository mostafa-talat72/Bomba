import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface ScrollButtonsProps {
  mainContentRef?: React.RefObject<HTMLElement>;
  hideButtons?: boolean;
}

const ScrollButtons: React.FC<ScrollButtonsProps> = ({ mainContentRef, hideButtons = false }) => {
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
      {/* زر الصعود للأعلى */}
      {showTopButton && isPageVisible && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-20 left-4 z-40 p-3 bg-orange-600 dark:bg-orange-700 text-white rounded-full shadow-lg hover:bg-orange-700 dark:hover:bg-orange-800 transition-all duration-200 hover:scale-110 lg:bottom-6 lg:left-6"
          title="الصعود للأعلى"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      )}

      {/* زر النزول للأسفل */}
      {showBottomButton && isPageVisible && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-4 left-4 z-40 p-3 bg-gray-600 dark:bg-gray-700 text-white rounded-full shadow-lg hover:bg-gray-700 dark:hover:bg-gray-800 transition-all duration-200 hover:scale-110 lg:bottom-6 lg:left-20"
          title="النزول للأسفل"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      )}
    </>
  );
};

export default ScrollButtons;
