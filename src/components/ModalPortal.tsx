import { createPortal } from 'react-dom';

const ModalPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // data-tab-modal: علامة لمراقب تبويبات الديسكتوب (مؤشر نافذة مفتوحة) —
  // display:contents بلا أي أثر على التخطيط أو التموضع الثابت
  return createPortal(
    <span data-tab-modal style={{ display: 'contents' }}>
      {children}
    </span>,
    document.body
  );
};

export default ModalPortal;
