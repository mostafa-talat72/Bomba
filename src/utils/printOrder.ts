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
      <div class="section-block" style="page-break-after: always; margin-bottom: 2px;">
        <!-- Header لكل قسم -->
        <div class="header">
          <h1>${establishmentName}</h1>
          ${isUpdatedOrder ? `
          <div class="update-banner">
            <span>🔄 تم تحديث الطلب</span>
            <small>${new Date(order.updatedAt!).toLocaleString('ar-EG')}</small>
          </div>` : ''}
        </div>

        <!-- معلومات الطلب لكل قسم -->
        <div class="order-info">
          <div style="margin-bottom: 2px;">
            <div style="font-size: 20px; font-weight: bold; margin: 2px 0;"><strong>${order.orderNumber}</strong></div>
            <div style="font-size: 16px; color: #333; margin: 2px 0;">${dateTimeString}</div>
            ${order.table?.number ? `
              <div style="font-size: 16px; margin: 2px 0; text-align: center;">
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
  size: auto;
  margin: 0;
}

/* ===== BODY ===== */
body {
  direction: rtl;
  font-family: 'Arial', sans-serif;
  margin: 0 auto;
  padding: 0 4mm;
  background: white;
  color: #000;
  font-size: 15px;
  line-height: 1;
  box-sizing: border-box;
  word-wrap: break-word;
}

/* ===== HEADER ===== */
.header {
  text-align: center;
  margin: 3px auto;
  padding: 3px 0;
}

.header h1 {
  font-size: 18px;
  margin: 0;
  padding: 6px 0 4px;
}

/* ===== SECTIONS ===== */
.section-block {
  margin-bottom: 2px;
  padding-bottom: 2px;
  border-bottom: 2px dashed #000;
}

.section-name {
  background-color: #f0f0f0;
  padding: 2px;
  margin: 2px 0 2px;
  font-size: 16px;
  font-weight: bold;
  text-align: center;
  border-radius: 2px;
}

/* ===== UPDATE BANNER ===== */
.update-banner {
  padding: 4px 0;
  margin: 4px 0;
}

.update-banner small {
  font-size: 12px;
  margin-top: 1px;
}

/* ===== ORDER INFO ===== */
.order-info {
  margin-bottom: 6px;
  padding-bottom: 6px;
  font-size: 16px;
  text-align: center;
  font-weight: bold;
}

.order-info p {
  margin: 2px 0;
}

/* ===== TABLE ===== */
.items {
  width: 100%;
  border-collapse: collapse;
  margin: 6px 0;
  table-layout: fixed;
  text-align: center;
  direction: rtl;
  border: 1px solid #000;
}

.items th,
.items td {
  padding: 4px 2px;
  font-size: 15px;
  border: 1px solid #000;
  text-align: center;
  vertical-align: middle;
  direction: rtl;
  unicode-bidi: plaintext;
}

/* ===== TABLE CELLS ===== */
.item-name {
  width: 70%;
  text-align: center;
  padding: 3px;
}

.item-qty {
  width: 30%;
  text-align: center;
  padding: 3px;
}

/* ===== HIDE PRICE COLUMN ONLY ===== */
.item-price {
  display: none !important;
}

/* ===== ITEM NOTES ===== */
.item-notes {
  font-size: 8px;
  color: #666;
  margin: 2px auto 0;
  padding: 0 4px;
  max-width: 60mm;
  text-align: center;
  font-style: italic;
}

/* ===== TOTAL (مجموع القسم) ===== */
.total {
  margin: 1px auto 0;
  padding: 1px 0;
  font-size: 18px;
  font-weight: bold;
  text-align: center;
  background-color: #f9f9f9;
  border-radius: 4px;
}

/* ===== NOTES ===== */
.notes {
  margin-top: 4px;
  font-size: 9px;
  padding: 0 4px;
  text-align: center;
}

/* ===== FOOTER ===== */
.footer {
  margin-top: 6px;
  padding-top: 6px;
  font-size: 12px;
  text-align: center;
  font-weight: bold;
  border-top: 1px dashed #000;
}

/* ===== PRINT ===== */
@media print {
  body { padding: 0; }
  .no-print { display: none !important; }

  .section-block {
    page-break-after: always;
    break-after: page;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .section-block:last-child {
    page-break-after: auto;
    break-after: auto;
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
        }, 100);
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
              }, 100);
            }, 50);
          };
        }
        // Clean up iframe
        document.body.removeChild(printFrame);
      }
    }, 50);
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
          }, 100);
        }, 50);
      };
    } else {
      alert('الرجاء السماح بالنوافذ المنبثقة لطباعة الطلب');
    }
  }
};

export default printOrder;