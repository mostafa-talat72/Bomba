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
  menuItem?: {
    category?: {
      section?: {
        _id?: string;
        name?: string;
      };
    };
  };
}

interface Order {
  _id: string;
  orderNumber: string;
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  table?: {
    _id: string;
    number: string | number;
    name?: string;
  };
  customerName?: string;
  items: OrderItem[];
  totalAmount?: number;
  finalAmount?: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  organization?: string | { _id: string; name: string };
}

interface MenuSection {
  _id: string;
  id?: string;
  name: string;
}

export const printOrder = async (
  order: Order, 
  menuSections: MenuSection[] = [],
  menuItemsMap: Map<string, { category?: { section?: string | MenuSection } }> = new Map(),
  fallbackOrganizationName?: string
) => {
  // جلب اسم المنشأة من بيانات الطلب أو استخدام الاحتياطي
  let establishmentName = fallbackOrganizationName || 'نظام إدارة المقاهي';
  
  // إذا كانت المنشأة موجودة في بيانات الطلب
  if ((order as any).organization) {
    const org = (order as any).organization;
    if (typeof org === 'object' && org.name) {
      // إذا كانت المنشأة populated object
      establishmentName = org.name;
    } else if (typeof org === 'string') {
      // إذا كانت المنشأة string ID فقط، نحاول جلب البيانات
      try {
        const response = await fetch(`/api/organizations/${org}`);
        if (response.ok) {
          const orgData = await response.json();
          if (orgData.success && orgData.data?.name) {
            establishmentName = orgData.data.name;
          }
        }
      } catch (error) {
        console.warn('Failed to fetch organization name for order:', error);
        // استخدام الاسم الاحتياطي في حالة الفشل
      }
    }
  }

  // Check if order.items exists and is an array
  if (!order.items || !Array.isArray(order.items)) {
    console.error('Order items is undefined or not an array:', order);
    return;
  }

  // تجميع العناصر حسب قسم المنيو
  const itemsBySection = new Map<string, OrderItem[]>();

  order.items.forEach(item => {
    // الحصول على قسم المنيو للعنصر
    let sectionId: string | null = null;
    let sectionName: string | null = null;

    // محاولة الحصول على menuItem من item.menuItem (قد يكون string ID أو object)
    const menuItemFromOrder = typeof item.menuItem === 'object' && item.menuItem !== null 
      ? (item.menuItem as any) 
      : null;
    
    const menuItemId = menuItemFromOrder 
      ? (menuItemFromOrder._id || menuItemFromOrder.id) 
      : (typeof item.menuItem === 'string' ? item.menuItem : null);
    
    // محاولة الحصول على category و section
    let category = null;
    let section = null;

    // أولاً: محاولة الحصول من menuItem في order.items مباشرة (إذا كان populated)
    if (menuItemFromOrder && menuItemFromOrder.category) {
      category = menuItemFromOrder.category;
      // إذا كان category object (populated)، نحصل على section منه
      if (typeof category === 'object' && category.section) {
        section = category.section;
      }
    }
    
    // ثانياً: إذا لم يكن موجوداً، نبحث في menuItemsMap
    if (!section && menuItemId) {
      // محاولة البحث بكل الأشكال الممكنة
      const menuItem = menuItemsMap.get(menuItemId) 
        || menuItemsMap.get(String(menuItemId))
        || (typeof menuItemId === 'object' && menuItemId 
          ? menuItemsMap.get((menuItemId as any)?._id || (menuItemId as any)?.id) 
          : null);
      
      if (menuItem) {
        // الحصول على category من menuItem
        if ((menuItem as any).category) {
          category = typeof (menuItem as any).category === 'string' 
            ? (menuItem as any).category 
            : ((menuItem as any).category as any);
          
          // إذا كان category object، نحصل على section منه
          if (category && typeof category === 'object' && category.section) {
            section = category.section;
          }
        }
      }
    }
    
    // الحصول على sectionId من section
    if (section) {
      if (typeof section === 'string') {
        sectionId = section;
      } else if (typeof section === 'object') {
        sectionId = (section as any)?._id || (section as any)?.id || null;
      }
      
      if (sectionId) {
        // البحث عن اسم القسم
        const sectionObj = menuSections.find(s => 
          s._id === sectionId || 
          s.id === sectionId ||
          String(s._id) === String(sectionId) ||
          String(s.id) === String(sectionId)
        );
        sectionName = sectionObj?.name || 'غير محدد';
      }
    }

    // إذا لم يكن هناك قسم، نضعه في قسم "أخرى"
    if (!sectionId) {
      sectionId = 'other';
      sectionName = 'أخرى';
    }

    if (!itemsBySection.has(sectionId)) {
      itemsBySection.set(sectionId, []);
    }
    itemsBySection.get(sectionId)!.push(item);
  });

  // طباعة جميع الأقسام في نفس الصفحة
  const sectionsArray = Array.from(itemsBySection.entries()).map(([sectionId, items]) => {
    const sectionName = sectionId === 'other' 
      ? 'أخرى'
      : menuSections.find(s => 
          s._id === sectionId || 
          s.id === sectionId ||
          String(s._id) === String(sectionId) ||
          String(s.id) === String(sectionId)
        )?.name || 'غير محدد';
    
    return { sectionId, sectionName, items };
  });

  // طباعة جميع الأقسام في صفحة واحدة باستخدام iframe
  printAllSectionsInOnePage(order, sectionsArray, establishmentName);
};

// دالة لطباعة جميع الأقسام في صفحة واحدة باستخدام iframe
const printAllSectionsInOnePage = (
  order: Order,
  sections: Array<{ sectionId: string; sectionName: string; items: OrderItem[] }>,
  establishmentName: string
) => {
  const now = new Date();
  const dateTimeString = now.toLocaleString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const isUpdatedOrder = order.updatedAt && 
    new Date(order.updatedAt).getTime() > new Date(order.createdAt).getTime();

  // إنشاء محتوى كل قسم - كل قسم يحتوي على معلومات كاملة
  const sectionsContent = sections.map(({ sectionName, items }) => {
    const sectionTotal = items.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity;
      const addonsTotal = item.addons?.reduce((addonSum, addon) =>
        addonSum + (addon.price * addon.quantity), 0) || 0;
      return sum + itemTotal + addonsTotal;
    }, 0);

    const formattedTotal = sectionTotal.toLocaleString('ar-EG', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });

    return `
      <div class="section-block" style="page-break-after: always; margin-bottom: 20px;">
        <!-- Header لكل قسم -->
        <div class="header">
          <h1>${establishmentName}</h1>
          ${isUpdatedOrder ? `
          <div class="update-banner">
            <span>🔄 تم تحديث الطلب</span>
            <small>${new Date(order.updatedAt!).toLocaleString('ar-EG')}</small>
          </div>` : ''}
          <div style="font-size: 16px; font-weight: bold; margin: 5px 0;">فاتورة طلب</div>
        </div>

        <!-- معلومات الطلب لكل قسم -->
        <div class="order-info">
          <div style="margin-bottom: 10px;">
            <div style="font-size: 20px; font-weight: bold; margin: 10px 0;"><strong>${order.orderNumber}</strong></div>
            <div style="font-size: 16px; color: #333; margin: 8px 0;">${dateTimeString}</div>
            ${order.table?.number ? `
              <div style="font-size: 16px; margin: 8px 0; text-align: center;">
                طاولة: <strong>${order.table.number}</strong>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- اسم القسم -->
        <div class="section-name">
          قسم: ${sectionName}
        </div>

        <!-- جدول العناصر -->
        <table class="items">
          <thead>
            <tr>
              <th class="item-name">الصنف</th>
              <th class="item-qty">الكمية</th>
              <th class="item-price">المجموع</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
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

        <!-- إجمالي القسم -->
        <div class="total">
          إجمالي القسم: <strong>${formattedTotal}</strong> ج.م
        </div>

        <!-- ملاحظات الطلب إذا كانت موجودة -->
        ${order.notes ? `
          <div class="notes">
            <strong>ملاحظات:</strong> ${order.notes}
          </div>
        ` : ''}

        <!-- Footer لكل قسم -->
        <div class="footer">
          شكراً لزيارتكم<br>
          <strong style="font-weight: 900; font-size: 14px;">تنفيذ مصطفى طلعت</strong> لإدارة الكافيهات والمطاعم والترفيه<br>
          <strong style="font-weight: 900; font-size: 16px; color: #333;">01116626164</strong>
        </div>
      </div>
    `;
  }).join('');

  const printContent = `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>طباعة الطلب #${order.orderNumber}</title>
      <style>
        @page {
          size:  auto;
          margin: 0;
          padding: 0;
        }
        body {
          direction: rtl;
          font-family: 'Arial', sans-serif;
          width: auto;
          max-width: auto;
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
        .section-block {
          margin-bottom: 15px;
          border-bottom: 2px dashed #000;
          padding-bottom: 15px;
        }
        .section-name {
          background-color: #f0f0f0;
          padding: 8px;
          text-align: center;
          font-weight: bold;
          font-size: 16px;
          margin: 10px 0 5px 0;
          border-radius: 4px;
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
          text-align: center;
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
          text-align: center;
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
          font-size: 12px;
          color: #000;
          border-top: 1px dashed #000;
          padding-top: 8px;
          width: 100%;
          font-weight: bold;
        }
        @media print {
          body {
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
          .section-block {
            page-break-after: always !important;
            -webkit-page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            -webkit-page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .section-block:last-child {
            page-break-after: auto !important;
            -webkit-page-break-after: auto !important;
            break-after: auto !important;
          }
        }
      </style>
    </head>
    <body>
      ${sectionsContent}
    </body>
    </html>
  `;

  // Create a hidden iframe for printing
  const printFrame = document.createElement('iframe');
  printFrame.style.position = 'absolute';
  printFrame.style.top = '-1000px';
  printFrame.style.left = '-1000px';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = 'none';
  
  document.body.appendChild(printFrame);
  
  const frameDoc = printFrame.contentDocument || printFrame.contentWindow?.document;
  if (frameDoc) {
    frameDoc.open();
    frameDoc.write(printContent);
    frameDoc.close();
    
    // Wait for content to load then print
    setTimeout(() => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
        
        // Clean up after printing
        setTimeout(() => {
          document.body.removeChild(printFrame);
        }, 1000);
      } catch (error) {
        console.error('Print error:', error);
        // Fallback to opening in new window if iframe printing fails
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.open();
          printWindow.document.write(printContent);
          printWindow.document.close();
          printWindow.onload = () => {
            setTimeout(() => {
              printWindow.print();
              setTimeout(() => {
                if (!printWindow.closed) {
                  printWindow.close();
                }
              }, 1000);
            }, 500);
          };
        }
        // Clean up iframe
        document.body.removeChild(printFrame);
      }
    }, 500);
  } else {
    // Fallback to original method if iframe fails
    document.body.removeChild(printFrame);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          setTimeout(() => {
            if (!printWindow.closed) {
              printWindow.close();
            }
          }, 1000);
        }, 500);
      };
    } else {
      alert('الرجاء السماح بالنوافذ المنبثقة لطباعة الطلب');
    }
  }
};

export default printOrder;