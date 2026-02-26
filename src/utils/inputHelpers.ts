/**
 * خصائص مشتركة لحقول الإدخال الرقمية
 * تمنع إدخال أي شيء غير الأرقام والنقطة العشرية
 */
export const numberOnlyInputProps = {
  controls: false,
  onKeyPress: (e: React.KeyboardEvent) => {
    // السماح فقط بالأرقام والنقطة العشرية والمفاتيح الخاصة
    const key = e.key;
    const isNumber = /\d/.test(key);
    const isDot = key === '.';
    const isBackspace = key === 'Backspace';
    const isTab = key === 'Tab';
    const isArrow = key.startsWith('Arrow');
    const isDelete = key === 'Delete';
    
    if (!isNumber && !isDot && !isBackspace && !isTab && !isArrow && !isDelete) {
      e.preventDefault();
    }
  }
};

/**
 * خصائص لحقول الأعداد الصحيحة فقط (بدون نقطة عشرية)
 */
export const integerOnlyInputProps = {
  controls: false,
  onKeyPress: (e: React.KeyboardEvent) => {
    // السماح فقط بالأرقام والمفاتيح الخاصة
    const key = e.key;
    const isNumber = /\d/.test(key);
    const isBackspace = key === 'Backspace';
    const isTab = key === 'Tab';
    const isArrow = key.startsWith('Arrow');
    const isDelete = key === 'Delete';
    
    if (!isNumber && !isBackspace && !isTab && !isArrow && !isDelete) {
      e.preventDefault();
    }
  }
};
