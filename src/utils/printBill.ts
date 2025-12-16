import { Bill, Order, Session, ItemPayment, SessionPayment } from '../services/api';
import { aggregateItemsWithPayments, AggregatedItem } from './billAggregation';

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



  // Format number without currency - no decimals
  const formatNumber = (amount: number | undefined | null) => {
    const safeAmount = amount ?? 0;
    const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    const rounded = Math.round(safeAmount);
    const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return formatted.replace(/\d/g, (digit) => arabicNumerals[parseInt(digit)]);
  };

  // Format quantity with Arabic numerals
  const formatQuantity = (qty: number) => {
    const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return qty.toString().replace(/\d/g, (digit) => arabicNumerals[parseInt(digit)]);
  };



  // Generate order items table
  const generateOrderItemsTable = (orders: Order[], itemPayments?: ItemPayment[], billStatus?: string, billPaid?: number, billTotal?: number) => {
    const aggregatedItems = aggregateItemsWithPayments(
      orders,
      itemPayments,
      billStatus,
      billPaid,
      billTotal
    );
    
    if (aggregatedItems.length === 0) {
      return '';
    }
    
    const itemsRows = aggregatedItems.map((item: AggregatedItem) => {
      const addonsText = item.addons && item.addons.length > 0
        ? ` (${item.addons.map(a => a.name).join(', ')})`
        : '';
      
      const isPaidFully = item.paidQuantity >= item.totalQuantity;
      const statusIcon = isPaidFully ? '✓' : item.paidQuantity > 0 ? '◐' : '○';
      
      return `
        <tr>
          <td class="item-name">${statusIcon} ${item.name}${addonsText}</td>
          <td class="item-quantity">${formatQuantity(item.totalQuantity)}</td>
          <td class="item-paid-qty">${formatQuantity(item.paidQuantity)}</td>
          <td class="item-total">${formatNumber(item.price * item.totalQuantity)}</td>
        </tr>
      `;
    }).join('');
    
    return `
      <div class="section-title">الطلبات</div>
      <table class="items-table">
        <thead>
          <tr>
            <th class="col-name" style="width: 50%;">الصنف</th>
            <th class="col-quantity" style="width: 16.67%;">الكمية</th>
            <th class="col-paid-qty" style="width: 16.67%;">مدفوع</th>
            <th class="col-total" style="width: 16.66%;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>
    `;
  };

  // Generate sessions table
  const generateSessionsTable = (sessions: Session[], sessionPayments?: SessionPayment[]) => {
    if (!sessions || sessions.length === 0) return '';

    const sessionsRows = sessions.map(session => {
      const startTime = new Date(session.startTime);
      const endTime = session.endTime ? new Date(session.endTime) : new Date();
      const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      const finalCost = session.finalCost ?? session.totalCost ?? 0;
      
      // Find session payment details
      const sessionPayment = sessionPayments?.find(sp => 
        sp.sessionId === session._id || sp.sessionId === session.id
      );
      const paidAmount = sessionPayment?.paidAmount || 0;
      const remainingAmount = sessionPayment?.remainingAmount || finalCost;
      
      // Status icon based on payment
      const isPaidFully = remainingAmount === 0;
      const statusIcon = isPaidFully ? '✓' : paidAmount > 0 ? '◐' : '○';
      
      return `
        <tr>
          <td class="item-name">${statusIcon} ${session.deviceName || session.deviceNumber || 'غير محدد'}</td>
          <td class="item-quantity">${formatQuantity(parseFloat(duration.toFixed(1)))} س</td>
          <td class="item-paid">${formatNumber(paidAmount)}</td>
          <td class="item-total">${formatNumber(finalCost)}</td>
        </tr>
      `;
    }).join('');
    
    return `
      <div class="section-title">الجلسات</div>
      <table class="items-table sessions-table">
        <thead>
          <tr>
            <th class="col-name" style="width: 40%;">الجهاز</th>
            <th class="col-quantity" style="width: 20%;">المدة</th>
            <th class="col-paid" style="width: 20%;">مدفوع</th>
            <th class="col-total" style="width: 20%;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${sessionsRows}
        </tbody>
      </table>
    `;
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
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
        * { 
          font-family: 'Tajawal', sans-serif; 
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          box-sizing: border-box;
        }
        body { 
          margin: 0; 
          padding: 8px 8px; 
          font-size: 11px; 
          color: #000; 
          font-weight: 600;
          width: 80mm;
          max-width: 80mm;
          text-align: center;
        }
        .header { 
          text-align: center; 
          margin-bottom: 8px;
          margin-top: 0;
          font-weight: 700;
          border-bottom: 2px dashed #000;
          padding-bottom: 6px;
        }
        .org-name { 
          font-size: 1.4em; 
          font-weight: 900; 
          margin-bottom: 6px; 
          color: #000;
        }
        .title { 
          font-size: 1.1em; 
          font-weight: 800; 
          margin-bottom: 6px; 
          color: #000;
        }
        .info { 
          margin-bottom: 4px; 
          font-weight: 600;
          font-size: 0.9em;
        }
        .divider { 
          border-top: 2px dashed #000; 
          margin: 10px 0; 
        }
        .section-title {
          font-size: 1.1em;
          font-weight: 800;
          margin: 10px 0 6px 0;
          text-align: center;
          background: #e0e0e0;
          padding: 4px;
          border-radius: 4px;
        }
        .items-table { 
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 10px;
          font-size: 0.85em;
          border: 2px solid #000;
          table-layout: fixed;
        }
        .items-table thead {
          background: #e0e0e0;
          font-weight: 800;
        }
        .items-table th {
          padding: 4px 3px;
          text-align: right;
          border: 1.5px solid #000;
          font-size: 0.9em;
          word-wrap: break-word;
        }
        .items-table td {
          padding: 3px 3px;
          text-align: right;
          border: 1px solid #000;
          font-weight: 600;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .items-table .item-name {
          text-align: left;
          font-weight: 700;
          padding-left: 5px;
          width: 50% !important;
        }
        .items-table .item-quantity {
          width: 16.67% !important;
        }
        .items-table .item-paid-qty {
          width: 16.67% !important;
          color: #4caf50;
          font-weight: 700;
        }
        .items-table .item-total {
          width: 16.66% !important;
        }
        .items-table.sessions-table .item-quantity {
          width: 20% !important;
        }
        .items-table.sessions-table .item-paid {
          width: 20% !important;
          color: #4caf50;
          font-weight: 700;
        }
        .items-table.sessions-table .item-total {
          width: 20% !important;
        }
        .items-table th:first-child {
          text-align: left;
          padding-left: 5px;
        }
        .total-section { 
          margin-top: 12px;
          text-align: center;
          font-weight: 800;
        }
        .total-row {
          text-align: center;
          padding: 6px 8px;
          margin-bottom: 4px;
          font-size: 1.1em;
          font-weight: 700;
        }
        .total-row.grand-total {
          font-size: 1.4em;
          font-weight: 900;
          background: #000;
          color: #fff;
          border-radius: 4px;
          margin-top: 8px;
          margin-bottom: 8px;
          padding: 8px;
        }
        .total-row.paid {
          font-size: 1.3em;
          font-weight: 900;
          color: #4caf50;
        }
        .total-row.remaining {
          font-size: 1.3em;
          font-weight: 900;
          color: #ff9800;
        }
        .footer { 
          margin-top: 12px; 
          text-align: center; 
          font-size: 1.1em; 
          color: #000;
          border-top: 2px dashed #000;
          padding-top: 10px;
          padding-bottom: 10px;
          font-weight: 800;
        }
        .thank-you { 
          text-align: center; 
          margin-top: 10px; 
          margin-bottom: 8px;
          font-size: 1.1em; 
          font-weight: 700; 
        }
        strong { 
          font-weight: 800; 
        }
        
        @media print {
          @page { 
            size: 80mm auto; 
            margin: 0; 
          }
          body { 
            margin: 0; 
            padding: 4px 6px; 
            font-weight: 600;
            width: 80mm;
          }
          .no-print { display: none !important; }
          .items-table {
            border: 2px solid #000 !important;
          }
          .items-table th,
          .items-table td {
            border: 1px solid #000 !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
        
        @media screen {
          body {
            max-width: 80mm;
            margin: 0 auto;
            background: #fff;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        ${organizationName ? `<div class="org-name">${organizationName}</div>` : ''}
        <div class="title">فاتورة ${bill.billNumber || ''}</div>
        <div class="info">${formatDate(bill.createdAt || new Date())}</div>
        ${bill.customerName ? `<div class="info">العميل: ${bill.customerName}</div>` : ''}
        ${bill.customerPhone ? `<div class="info">الهاتف: ${bill.customerPhone}</div>` : ''}
      </div>

      <div class="divider"></div>

      ${bill.orders && bill.orders.length > 0 ? generateOrderItemsTable(bill.orders, bill.itemPayments, bill.status, bill.paid, bill.total) : ''}

      ${bill.sessions && bill.sessions.length > 0 ? generateSessionsTable(bill.sessions, bill.sessionPayments) : ''}

      <div class="divider"></div>

      <div class="total-section">
        ${bill.discount && bill.discount > 0 ? `
          <div class="total-row">
            الخصم: ${formatNumber(bill.discount)}
          </div>
        ` : ''}
        ${bill.tax && bill.tax > 0 ? `
          <div class="total-row">
            الضريبة: ${formatNumber(bill.tax)}
          </div>
        ` : ''}
        <div class="total-row grand-total">
          الإجمالي الكلي: ${formatNumber(bill.total || 0)}
        </div>
        <div class="total-row paid">
          المدفوع: ${formatNumber(bill.paid || 0)}
        </div>
        <div class="total-row remaining">
          المتبقي: ${formatNumber(bill.remaining || 0)}
        </div>
      </div>

      <div class="thank-you">شكراً لزيارتكم</div>
      
      <div class="footer">
        <div><strong style="font-weight: 900; font-size: 14px;">العبيلى</strong> لإدارة الكافيهات والمطاعم والترفيه</div>
        <div><strong style="font-weight: 900; font-size: 16px; color: #333;">01116626164</strong></div>
      </div>

      <div class="no-print" style="margin-top: 20px; text-align: center; padding: 10px;">
        <button onclick="window.print()" style="
          background: #4CAF50;
          color: white;
          border: none;
          padding: 10px 20px;
          text-align: center;
          text-decoration: none;
          display: inline-block;
          font-size: 14px;
          font-weight: 700;
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

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.onbeforeunload = null;
        printWindow.onafterprint = () => {
          setTimeout(() => {
            printWindow.close();
          }, 100);
        };
        
        printWindow.print();
        
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
