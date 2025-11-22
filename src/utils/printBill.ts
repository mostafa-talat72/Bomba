import { Bill, Order, Session } from '../services/api';

export const printBill = (bill: Bill, organizationName?: string) => {
  // Format date in Arabic
  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleString('ar-EG', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Convert numbers to Arabic numerals
  const toArabicNumerals = (num: number) => {
    const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num.toString().replace(/\d/g, (digit) => arabicNumerals[parseInt(digit)]);
  };

  // Format currency in EGP with Arabic numerals
  const formatCurrency = (amount: number | undefined | null) => {
    // Handle undefined or null values
    const safeAmount = amount ?? 0;
    
    // Convert to Arabic numerals
    const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    const formatted = safeAmount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    return formatted.replace(/\d/g, (digit) => arabicNumerals[parseInt(digit)]) + ' ج.م';
  };

  // Format quantity with Arabic numerals
  const formatQuantity = (qty: number) => {
    const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return qty.toString().replace(/\d/g, (digit) => arabicNumerals[parseInt(digit)]);
  };

  // Generate order items HTML - Grouped by item name and price
  const generateOrderItems = (orders: Order[]) => {
    // Create a map to group items by name and price
    const itemsMap = new Map<string, {name: string, price: number, quantity: number}>();
    
    // Process all orders and items
    orders.forEach(order => {
      order.items.forEach(item => {
        const key = `${item.name}_${item.price}`;
        if (itemsMap.has(key)) {
          const existing = itemsMap.get(key)!;
          existing.quantity += item.quantity;
        } else {
          itemsMap.set(key, {
            name: item.name,
            price: item.price,
            quantity: item.quantity
          });
        }
      });
    });
    
    // Generate HTML for each unique item with total quantity
    const itemsHtml = Array.from(itemsMap.values()).map(item => {
      return `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>${formatQuantity(item.quantity)} × ${item.name}</span>
          <span>${formatCurrency(item.price * item.quantity)}</span>
        </div>
      `;
    }).join('');
    
    return `
      <div style="border-bottom: 1px dashed #ddd; padding: 8px 0; margin-bottom: 8px;">
        <div style="font-weight: bold; margin-bottom: 4px;">الطلبات</div>
        <div style="margin-right: 10px;">
          ${itemsHtml}
        </div>
      </div>
    `;
  };

  // Generate sessions HTML
  const generateSessions = (sessions: Session[]) => {
    return sessions.map(session => {
      const startTime = new Date(session.startTime);
      const endTime = session.endTime ? new Date(session.endTime) : new Date();
      const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60); // in hours
      
      // Get costs with fallback values
      const finalCost = session.finalCost ?? session.totalCost ?? 0;

      return `
        <div style="border-bottom: 1px dashed #ddd; padding: 8px 0; margin-bottom: 8px;">
          <div style="font-weight: bold; margin-bottom: 4px;">
            جلسة ${session.deviceName || session.deviceNumber || 'غير محدد'}
          </div>
          <div style="margin-right: 10px;">
            <div style="display: flex; justify-content: space-between;">
              <span>المدة:</span>
              <span>${formatQuantity(parseFloat(duration.toFixed(1)))} ساعة</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
              <span>المجموع:</span>
              <span>${formatCurrency(finalCost)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  };

  // Generate payments HTML
  const generatePayments = (payments: any[]) => {
    if (!payments || payments.length === 0) return '';

    return `
      <div style="margin-top: 10px; border-top: 1px solid #000; padding-top: 10px;">
        <div style="font-weight: bold; margin-bottom: 5px;">المدفوعات:</div>
        ${payments.map(payment => `
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>${formatDate(payment.timestamp)} - ${getPaymentMethodText(payment.method)}</span>
            <span>${formatCurrency(payment.amount)}</span>
          </div>
        `).join('')}
      </div>
    `;
  };

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'cash': return 'نقداً';
      case 'card': return 'بطاقة';
      case 'transfer': return 'تحويل';
      default: return method;
    }
  };

  // Main receipt HTML
  const receiptHTML = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>فاتورة ${bill.billNumber || ''}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap');
        * { font-family: 'Tajawal', sans-serif; }
        body { margin: 0; padding: 16px; font-size: 14px; color: #1a1a1a; }
        .header { text-align: center; margin-bottom: 16px; }
        .title { font-size: 1.5rem; font-weight: bold; margin-bottom: 8px; }
        .info { margin-bottom: 8px; }
        .divider { border-top: 1px dashed #000; margin: 12px 0; }
        .items { margin-bottom: 12px; }
        .item { display: flex; justify-content: space-between; margin-bottom: 4px; }
        .total { font-weight: bold; margin-top: 8px; }
        .footer { margin-top: 16px; text-align: center; font-size: 0.9em; color: #666; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .mb-2 { margin-bottom: 8px; }
        .discount { color: #e53e3e; }
        .thank-you { text-align: center; margin-top: 16px; font-size: 1.1em; font-weight: 500; }
        .org-name { font-size: 1.3rem; font-weight: 900; margin-bottom: 4px; }
      </style>
    </head>
    <body>
      <div class="header">
        ${organizationName ? `<div class="org-name">${organizationName}</div>` : ''}
        <div class="title">فاتورة ${bill.billNumber || ''}</div>
        <div>${formatDate(bill.createdAt || new Date())}</div>
        ${bill.customerName ? `<div>العميل: ${bill.customerName}</div>` : ''}
        ${bill.customerPhone ? `<div>الهاتف: ${bill.customerPhone}</div>` : ''}
        ${bill.discountPercentage && bill.discountPercentage > 0 ? 
          `<div class="discount">نسبة الخصم: ${toArabicNumerals(bill.discountPercentage)}%</div>` : ''}
      </div>

      <div class="divider"></div>

      ${bill.orders && bill.orders.length > 0 ? `
        <div class="items">
          <div class="text-center mb-2">الطلبات</div>
          ${generateOrderItems(bill.orders)}
        </div>
      ` : ''}

      ${bill.sessions && bill.sessions.length > 0 ? `
        <div class="items">
          <div class="text-center mb-2">الجلسات</div>
          ${generateSessions(bill.sessions)}
        </div>
      ` : ''}

      ${generatePayments(bill.payments)}

      <div class="total text-right">
        <div>الإجمالي: ${formatCurrency(bill.subtotal || 0)}</div>
        ${bill.discountPercentage && bill.discountPercentage > 0 ? 
          `<div>نسبة الخصم: ${toArabicNumerals(bill.discountPercentage)}% (${formatCurrency((bill.subtotal || 0) * (bill.discountPercentage / 100))})</div>` : ''}
        ${bill.discount && (!bill.discountPercentage || bill.discountPercentage === 0) ? 
          `<div>الخصم: ${formatCurrency(bill.discount)}</div>` : ''}
        ${bill.tax ? `<div>الضريبة: ${formatCurrency(bill.tax)}</div>` : ''}
        <div>المجموع النهائي: ${formatCurrency(bill.total || 0)}</div>
        <div>المدفوع: ${formatCurrency(bill.paid || 0)}</div>
        <div>المتبقي: ${formatCurrency(bill.remaining || 0)}</div>
      </div>

      <div class="thank-you">شكراً لزيارتكم</div>
      <div class="footer">
        <div><strong style="font-weight: 900;">العبيلى</strong> لإدارة الكافيهات والمطاعم والترفيه</div>
        <div>${formatDate(new Date())}</div>
      </div>

      <div class="no-print" style="margin-top: 20px; text-align: center;">
        <button onclick="window.print()" style="
          background: #4CAF50;
          color: white;
          border: none;
          padding: 10px 20px;
          text-align: center;
          text-decoration: none;
          display: inline-block;
          font-size: 16px;
          margin: 4px 2px;
          cursor: pointer;
          border-radius: 4px;
        ">
          طباعة الفاتورة
        </button>
      </div>
    </body>
    </html>
  `;

  // Open print window
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(receiptHTML);
    printWindow.document.close();

    // Auto-print after content loads
    printWindow.onload = () => {
      setTimeout(() => {
        // Add afterPrint event listener to close the window after printing
        printWindow.onbeforeunload = null; // Prevent the confirmation dialog
        printWindow.onafterprint = () => {
          // Close the window after a short delay to ensure printing has started
          setTimeout(() => {
            printWindow.close();
          }, 100);
        };
        
        // Trigger the print dialog
        printWindow.print();
        
        // Fallback in case onafterprint doesn't fire
        setTimeout(() => {
          if (!printWindow.closed) {
            printWindow.close();
          }
        }, 5000);
      }, 500);
    };
  } else {
    alert('الرجاء السماح بالنوافذ المنبثقة لطباعة الفاتورة');
  }
};

export default printBill;
