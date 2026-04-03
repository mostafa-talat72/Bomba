/**
 * Custom hook for RTL support
 * Provides utility functions and classes for RTL/LTR layouts
 */

import { useLanguage } from '../context/LanguageContext';

export const useRTL = () => {
  const { isRTL, currentLanguage } = useLanguage();

  /**
   * Get direction attribute value
   */
  const dir = isRTL ? 'rtl' : 'ltr';

  /**
   * Get text alignment class
   */
  const textAlign = isRTL ? 'text-right' : 'text-left';

  /**
   * Get flex direction class
   */
  const flexDirection = isRTL ? 'flex-row-reverse' : 'flex-row';

  /**
   * Get margin left class (becomes margin right in RTL)
   * @param size - Tailwind spacing size (e.g., '4', '2', 'auto')
   */
  const ml = (size: string) => (isRTL ? `mr-${size}` : `ml-${size}`);

  /**
   * Get margin right class (becomes margin left in RTL)
   * @param size - Tailwind spacing size (e.g., '4', '2', 'auto')
   */
  const mr = (size: string) => (isRTL ? `ml-${size}` : `mr-${size}`);

  /**
   * Get padding left class (becomes padding right in RTL)
   * @param size - Tailwind spacing size (e.g., '4', '2')
   */
  const pl = (size: string) => (isRTL ? `pr-${size}` : `pl-${size}`);

  /**
   * Get padding right class (becomes padding left in RTL)
   * @param size - Tailwind spacing size (e.g., '4', '2')
   */
  const pr = (size: string) => (isRTL ? `pl-${size}` : `pr-${size}`);

  /**
   * Get left position class (becomes right in RTL)
   * @param size - Tailwind spacing size (e.g., '0', '4', '1/2')
   */
  const left = (size: string) => (isRTL ? `right-${size}` : `left-${size}`);

  /**
   * Get right position class (becomes left in RTL)
   * @param size - Tailwind spacing size (e.g., '0', '4', '1/2')
   */
  const right = (size: string) => (isRTL ? `left-${size}` : `right-${size}`);

  /**
   * Get rounded corner classes for start side
   */
  const roundedStart = isRTL ? 'rounded-r' : 'rounded-l';

  /**
   * Get rounded corner classes for end side
   */
  const roundedEnd = isRTL ? 'rounded-l' : 'rounded-r';

  /**
   * Get border side class for start
   */
  const borderStart = isRTL ? 'border-r' : 'border-l';

  /**
   * Get border side class for end
   */
  const borderEnd = isRTL ? 'border-l' : 'border-r';

  /**
   * Get space-x-reverse class for RTL
   */
  const spaceX = (size: string) => 
    isRTL ? `space-x-${size} space-x-reverse` : `space-x-${size}`;

  /**
   * Get divide-x-reverse class for RTL
   */
  const divideX = isRTL ? 'divide-x divide-x-reverse' : 'divide-x';

  /**
   * Conditional class based on RTL
   * @param rtlClass - Class to use in RTL mode
   * @param ltrClass - Class to use in LTR mode
   */
  const conditional = (rtlClass: string, ltrClass: string) => 
    isRTL ? rtlClass : ltrClass;

  /**
   * Get input direction (some inputs should always be LTR)
   * @param type - Input type ('email', 'tel', 'number', 'date', 'time', 'url')
   */
  const inputDir = (type?: string) => {
    const ltrTypes = ['email', 'tel', 'number', 'date', 'time', 'datetime-local', 'url'];
    if (type && ltrTypes.includes(type)) {
      return 'ltr';
    }
    return dir;
  };

  /**
   * Get input text alignment class
   * @param type - Input type
   */
  const inputTextAlign = (type?: string) => {
    const ltrTypes = ['email', 'tel', 'number', 'date', 'time', 'datetime-local', 'url'];
    if (type && ltrTypes.includes(type)) {
      return 'text-left';
    }
    return textAlign;
  };

  return {
    isRTL,
    currentLanguage,
    dir,
    textAlign,
    flexDirection,
    ml,
    mr,
    pl,
    pr,
    left,
    right,
    roundedStart,
    roundedEnd,
    borderStart,
    borderEnd,
    spaceX,
    divideX,
    conditional,
    inputDir,
    inputTextAlign,
  };
};
