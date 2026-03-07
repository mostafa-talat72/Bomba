interface OrderItem {
  _id: string;
  name: string;
  arabicName?: string;
  price: number;
  quantity: number;
  notes?: string;
  preparedCount?: number;
  addons?: Array<{
    _id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
}

interface Order {
  _id: string;
  orderNumber: string;
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  customerName?: string;
  items: OrderItem[];
  totalAmount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// دالة لطباعة الفاتورة على طابعة 80 مم
export const printKitchenOrder = (order: Order, establishmentName: string = 'اسم المنشأة') => {
  // إنشاء نافذة طباعة جديدة
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  // تنسيق التاريخ والوقت
  const now = new Date();
  const dateTimeString = now.toLocaleString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  // Check if this is an updated order
  const isUpdatedOrder = (order as any).updatedAt && 
    new Date((order as any).updatedAt).getTime() > new Date(order.createdAt).getTime();

  // إنشاء محتوى الفاتورة
  let printContent = `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>${isUpdatedOrder ? 'تعديل ' : ''}طباعة الطلب #${order.orderNumber}</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
          padding: 0;
        }
        @page {
          size: 80mm auto;
          margin: 0;
          padding: 0;
        }
        body {
          direction: rtl;
          font-family: 'Arial', sans-serif;
          width: 72mm; /* Slightly less than paper width */
          max-width: 72mm;
          margin: 0 auto;
          padding: 0 4mm;
          background: white;
          color: #000;
          font-size: 15px;
          line-height: 1.4;
          word-wrap: break-word;
          overflow-wrap: break-word;
          box-sizing: border-box;
        }
        .header {
          text-align: center;
          margin: 5px auto;
          padding: 5px 0;
          border-bottom: 1px dashed #000;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }
        .header h1 {
          font-size: 18px;
          margin: 0;
          padding: 10px 0 5px;
          text-align: center;
          border-bottom: 1px dashed #ddd;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        
        .update-banner {
          background-color: #fff3cd;
          color: #856404;
          padding: 5px 0;
          text-align: center;
          font-weight: bold;
          border-radius: 4px;
          margin: 5px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          border: 1px dashed #ffeeba;
        }
        
        .update-banner small {
          font-size: 12px;
          opacity: 0.8;
          margin-top: 2px;
        }
        .order-info {
          margin-bottom: 10px;
          border-bottom: 1px dashed #000;
          padding-bottom: 10px;
          font-size: 16px;
          text-align: center;
          font-weight: bold;
        }
        .order-info p {
          margin: 3px 0;
          text-align: center;
          justify-content: center;
        }
        .items {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
          table-layout: fixed;
          text-align: center;
          direction: rtl;
        }
        .items th, .items td {
          padding: 6px 0;
          text-align: center;
          border-bottom: 1px dashed #eee;
          font-size: 15px;
          word-break: break-word;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .item-name {
          text-align: right;
          padding: 4px 8px 4px 4px;
          width: 50%;
          word-wrap: break-word;
          overflow-wrap: break-word;
          direction: rtl;
          unicode-bidi: embed;
        }
        .item-qty {
          text-align: center;
          width: 30px;
          direction: rtl;
          unicode-bidi: embed;
        }
        .item-price {
          text-align: left;
          padding: 4px 4px 4px 8px;
          width: 30%;
          word-wrap: break-word;
          overflow-wrap: break-word;
          direction: rtl;
          unicode-bidi: embed;
        }
        .item-notes {
          font-size: 8px;
          color: #666;
          padding: 0 5px;
          font-style: italic;
          max-width: 60mm;
          word-break: break-word;
          text-align: center;
          margin: 0 auto;
        }
        .total {
          margin: 15px auto 0;
          text-align: center;
          font-weight: bold;
          font-size: 18px;
          border-top: 2px dashed #000;
          padding: 10px 0;
          width: 100%;
          background-color: #f9f9f9;
          border-radius: 4px;
        }
        .notes {
          margin: 5px auto 0;
          font-size: 9px;
          color: #666;
          padding: 0 5px;
          text-align: center;
          width: 100%;
        }
        .footer {
          margin: 5px auto 0;
          text-align: center;
          font-size: 9px;
          color: #666;
          border-top: 1px dashed #000;
          padding-top: 5px;
          width: 100%;
        }
        @media print {
          body {
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>مارسيليا لإدارة الكافيهات والمطاعم</h1>
        ${isUpdatedOrder ? `
        <div class="update-banner">
          <span>🔄 تم تحديث الطلب</span>
          <small>${new Date((order as any).updatedAt).toLocaleString('ar-EG')}</small>
        </div>` : ''}
        <div style="font-size: 16px; font-weight: bold; margin: 5px 0;">فاتورة طلب</div>
      </div>

      <div class="order-info">
        <div style="margin-bottom: 10px;">
          <div style="font-size: 20px; font-weight: bold; margin: 10px 0;"><strong>${order.orderNumber}</strong></div>
          <div style="font-size: 16px; color: #333; margin: 8px 0;">${dateTimeString}</div>
          ${order.customerName ? `
            <div style="font-size: 16px; margin: 8px 0; text-align: center;">
              ترابيزه: <strong>${order.customerName ? order.customerName.toString().replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]) : ''}</strong>
            </div>
          ` : ''}
        </div>
      </div>

      <table class="items">
        <thead>
          <tr>
            <th class="item-name">الصنف</th>
            <th class="item-qty">الكمية</th>
            <th class="item-price">المجموع</th>
          </tr>
        </thead>
        <tbody>
          ${order.items.map(item => `
            <tr>
              <td class="item-name">${item.name}${item.notes ? `<br><small>(${item.notes})</small>` : ''}</td>
              <td class="item-qty"><strong>${item.quantity.toLocaleString('ar-EG')}</strong></td>
              <td class="item-price"><strong>${(item.price * item.quantity).toLocaleString('ar-EG', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
              })}</strong></td>
            </tr>
            ${item.addons && item.addons.length > 0 ?
              item.addons.map(addon => `
                <tr>
                  <td class="item-name" style="padding-right: 15px;">+ ${addon.name}</td>
                  <td class="item-qty"><strong>${addon.quantity.toLocaleString('ar-EG')}</strong></td>
                  <td class="item-price"><strong>${(addon.price * addon.quantity).toLocaleString('ar-EG', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2
                  })}</strong></td>
                </tr>
              `).join('') : ''
            }
          `).join('')}
        </tbody>
      </table>

      ${(() => {
        // Calculate total by summing all items and their add-ons
        const total = order.items.reduce((sum, item) => {
          const itemTotal = item.price * item.quantity;
          const addonsTotal = item.addons?.reduce((addonSum, addon) =>
            addonSum + (addon.price * addon.quantity), 0) || 0;
          return sum + itemTotal + addonsTotal;
        }, 0);

        // Format number to Arabic numerals
        const formattedTotal = total.toLocaleString('ar-EG', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        });
        
        // Get currency from localStorage
        const organizationCurrency = localStorage.getItem('organizationCurrency') || 'EGP';
        const currencySymbols: { [key: string]: string } = {
          'EGP': 'ج.م',
          'SAR': 'ر.س',
          'AED': 'د.إ',
          'USD': '$',
          'EUR': '€',
          'GBP': '£'
        };
        const currencySymbol = currencySymbols[organizationCurrency] || organizationCurrency;

        return `
          <div class="total">
            الإجمالي: <strong>${formattedTotal}</strong> ${currencySymbol}
          </div>
        `;
      })()}

      ${order.notes ? `
        <div class="notes">
          <strong>ملاحظات:</strong> ${order.notes}
        </div>
      ` : ''}

      <div class="footer">
        شكراً لزيارتكم<br>
        ${new Date().getFullYear()} © جميع الحقوق محفوظة
      </div>

      <div class="no-print" style="margin-top: 20px; text-align: center;">
        <button onclick="window.print()" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
          طباعة الفاتورة
        </button>
        <button onclick="window.close()" style="padding: 8px 16px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
          إغلاق
        </button>
      </div>

      <script>
        // طباعة الفاتورة تلقائياً عند فتح النافذة
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 500);

          // إغلاق النافذة بعد 5 ثوانٍ
          setTimeout(function() {
            window.close();
          }, 5000);
        };
      </script>
    </body>
    </html>
  `;

  // كتابة المحتوى في نافذة الطباعة
  printWindow.document.open();
  printWindow.document.write(printContent);
  printWindow.document.close();
};

// دالة مساعدة لتنسيق العملة
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 2
  }).format(amount);
};

// دالة لحساب الإجمالي مع الإضافات
const calculateTotal = (order: Order) => {
  let total = 0;
  order.items.forEach(item => {
    total += item.price * item.quantity;
    if (item.addons && item.addons.length > 0) {
      item.addons.forEach(addon => {
        total += addon.price * addon.quantity;
      });
    }
  });
  return total;
};

// دالة مساعدة للحصول على حالة الطلب بالعربية
const getStatusArabic = (status: string) => {
  switch (status) {
    case 'pending':
      return 'قيد الانتظار';
    case 'preparing':
      return 'قيد التحضير';
    case 'ready':
      return 'جاهز للتسليم';
    case 'delivered':
      return 'تم التسليم';
    case 'cancelled':
      return 'ملغي';
    default:
      return status;
  }
};
