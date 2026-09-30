import api from '../services/api';
import { toast } from 'react-toastify';
import { formatDecimal, getCurrencySymbol, getDisplayNumber } from './formatters';
import type { TFunction } from 'i18next';
import { getCachedDevicePrinter, printThroughLocalBridge } from './localPrintBridge';
import { getCurrentUserCache } from './currentUser';
import { resolveDocLayout, brandHtml, layoutCss, printFontImport, DEFAULT_DOC_LAYOUT, DocPrintLayout } from './printLayout';
import { isMobileDevice } from './deviceDetect';

interface OrderItem {
  _id?: string;
  name: string;
  arabicName?: string;
  price: number;
  variant?: string | null;
  quantity: number;
  notes?: string;
  preparedCount?: number;
  addons?: Array<{
    _id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  menuItem?: string | {
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
  status: 'draft' | 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  table?: {
    _id: string;
    number: string | number;
    name?: string;
  };
  customerName?: string;
  customerPhone?: string;
  items: OrderItem[];
  totalAmount?: number;
  finalAmount?: number;
  notes?: string;
  fulfillmentType?: 'dine_in' | 'takeaway' | 'delivery';
  createdAt: string | Date;
  updatedAt?: string;
  organization?: string | { _id: string; name: string };
}

interface MenuSection {
  _id: string;
  id?: string;
  name: string;
}

export const buildOrderPrintHTML = async (
  order: Order, 
  menuSections: MenuSection[] = [],
  menuItemsMap: Map<string, { category?: { section?: string | MenuSection } }> = new Map(),
  fallbackOrganizationName?: string,
  language: string = 'ar',
  t: TFunction = ((key: string) => key) as TFunction,
  tableSectionName?: string,
  selectedSectionIds?: string[],
  extra?: { logoUrl?: string; layout?: DocPrintLayout; printFont?: string; customFooter?: string; copyPrinters?: Array<string | undefined>; billNumber?: string }
): Promise<string> => {
  // Get establishment name from order data or use fallback
  let establishmentName = fallbackOrganizationName || t('orderPrint.defaultEstablishment') || 'Cafe Management System';
  
  // If organization exists in order data
  if ((order as any).organization) {
    const org = (order as any).organization;
    if (typeof org === 'object' && org.name) {
      // If organization is a populated object
      establishmentName = org.name;
    } else if (typeof org === 'string') {
      // ⚡ اسم المنشأة الممرر من الذاكرة يكفي — لا انتظار شبكة إطلاقاً.
      // (كل المنادين يمررون user.organizationName مسبقاً)
      if (fallbackOrganizationName) {
        establishmentName = fallbackOrganizationName;
      } else {
        try {
          const response = await Promise.race([
            fetch(`/api/organization/${org}`),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 800)),
          ]) as Response | null;
          if (response && response.ok) {
            const orgData = await response.json();
            if (orgData.success && orgData.data?.name) {
              establishmentName = orgData.data.name;
            }
          }
        } catch (error) {
          console.warn('Failed to fetch organization name for order:', error);
        }
      }
    }
  }

  // Check if order.items exists and is an array
  if (!order.items || !Array.isArray(order.items)) {
    console.error('Order items is undefined or not an array:', order);
    return '';
  }

  // Group items by menu section
  const itemsBySection = new Map<string, OrderItem[]>();
  // Names stamped on items (no menu permission needed)
  const stampedNames = new Map<string, string>();

  order.items.forEach(item => {
    // Get menu section for item
    let sectionId: string | null = null;
    let sectionName: string | null = null;

    // First: stamped snapshot on the item itself (works with zero menu permission)
    const stampedSection: any = (item as any).section;
    const stampedName: any = (item as any).sectionName;
    if (stampedSection) {
      sectionId = String(stampedSection._id || stampedSection.id || stampedSection);
    }
    if (stampedName && typeof stampedName === 'string' && stampedName.trim()) {
      sectionName = stampedName.trim();
    }
    if (sectionId && sectionName) {
      const key = sectionId;
      if (!itemsBySection.has(key)) itemsBySection.set(key, []);
      if (!stampedNames.has(key)) stampedNames.set(key, sectionName);
      itemsBySection.get(key)!.push(item);
      return;
    }

    // Try to get menuItem from item.menuItem (could be string ID or object)
    const menuItemFromOrder = typeof item.menuItem === 'object' && item.menuItem !== null 
      ? (item.menuItem as any) 
      : null;
    
    const menuItemId = menuItemFromOrder 
      ? (menuItemFromOrder._id || menuItemFromOrder.id) 
      : (typeof item.menuItem === 'string' ? item.menuItem : null);
    
    // Try to get category and section
    let category = null;
    let section = null;

    // First: Try to get from menuItem in order.items directly (if populated)
    if (menuItemFromOrder && menuItemFromOrder.category) {
      category = menuItemFromOrder.category;
      // If category is object (populated), get section from it
      if (typeof category === 'object' && category.section) {
        section = category.section;
      }
    }
    
    // Second: If not found, search in menuItemsMap
    if (!section && menuItemId) {
      // Try searching in all possible forms
      const menuItem = menuItemsMap.get(menuItemId) 
        || menuItemsMap.get(String(menuItemId))
        || (typeof menuItemId === 'object' && menuItemId 
          ? menuItemsMap.get((menuItemId as any)?._id || (menuItemId as any)?.id) 
          : null);
      
      if (menuItem) {
        // Get category from menuItem
        if ((menuItem as any).category) {
          category = typeof (menuItem as any).category === 'string' 
            ? (menuItem as any).category 
            : ((menuItem as any).category as any);
          
          // If category is object, get section from it
          if (category && typeof category === 'object' && category.section) {
            section = category.section;
          }
        }
      }
    }
    
    // Get sectionId from section
    if (section) {
      if (typeof section === 'string') {
        sectionId = section;
      } else if (typeof section === 'object') {
        sectionId = (section as any)?._id || (section as any)?.id || null;
      }
      
      if (sectionId) {
        // Search for section name
        const sectionObj = menuSections.find(s => 
          s._id === sectionId || 
          s.id === sectionId ||
          String(s._id) === String(sectionId) ||
          String(s.id) === String(sectionId)
        );
        sectionName = sectionObj?.name || t('orderPrint.unspecifiedSection');
      }
    }

    // If no section, put in "Other" section
    if (!sectionId) {
      sectionId = 'other';
      sectionName = t('orderPrint.otherSection');
    }

    if (!itemsBySection.has(sectionId)) {
      itemsBySection.set(sectionId, []);
    }
    itemsBySection.get(sectionId)!.push(item);
  });

  // Print all sections on same page
  const sectionsArray = Array.from(itemsBySection.entries()).filter(([sectionId]) =>
    !selectedSectionIds || selectedSectionIds.includes(sectionId)
  ).map(([sectionId, items]) => {
    const sectionName = sectionId === 'other'
      ? t('orderPrint.otherSection')
      : menuSections.find(s =>
          s._id === sectionId ||
          s.id === sectionId ||
          String(s._id) === String(sectionId) ||
          String(s.id) === String(sectionId)
        )?.name || stampedNames.get(sectionId) || t('orderPrint.unspecifiedSection');

    return { sectionId, sectionName, items };
  });

  // Print all sections on one page using iframe
  return printAllSectionsInOnePage(order, sectionsArray, establishmentName, language, t, tableSectionName, extra);
};

// Function to print all sections on one page using iframe
const printAllSectionsInOnePage = (
  order: Order,
  sections: Array<{ sectionId: string; sectionName: string; items: OrderItem[] }>,
  establishmentName: string,
  language: string,
  t: TFunction,
  tableSectionName?: string,
  extra?: { logoUrl?: string; layout?: DocPrintLayout; printFont?: string; customFooter?: string; copyPrinters?: Array<string | undefined>; billNumber?: string }
) => {
  const now = new Date();
  const locale = language === 'ar' ? 'ar-EG' : language === 'fr' ? 'fr-FR' : 'en-US';
  const organizationTimezone = localStorage.getItem('organizationTimezone') || 'Africa/Cairo';
  const billNum = String(extra?.billNumber || (order as any)?.billNumber || ((order as any)?.bill && typeof (order as any).bill === 'object' ? (order as any).bill.billNumber : null) || '');

  const isUpdatedOrder = order.updatedAt && 
    new Date(order.updatedAt).getTime() > new Date(order.createdAt).getTime();

  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const align = language === 'ar' ? 'right' : 'left';
  const layout = extra?.layout || DEFAULT_DOC_LAYOUT;
  const showPrice = layout.showPriceCol === true;
  const showTotal = layout.showTotalCol === true;
  const logoUrl = extra?.logoUrl;
  const printFont = extra?.layout?.printFont || extra?.printFont || 'Tajawal';
  const showLogo = layout.logoShow !== false && layout.logoPosition !== 'hide' && !!logoUrl;
  const logoW = Math.min(200, Math.max(40, Number(layout.logoWidth) || 110));
  const logoImg = showLogo ? `<img src="${logoUrl}" style="width:${logoW}px;max-width:${logoW}px;height:auto;" />` : '';

  // Create content for each section - each section contains complete information
  const sectionsContent = sections.map(({ sectionName, items }) => {
    const sectionTotal = items.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity;
      const addonsTotal = item.addons?.reduce((addonSum, addon) =>
        addonSum + (addon.price * addon.quantity), 0) || 0;
      return sum + itemTotal + addonsTotal;
    }, 0);

    const formattedTotal = formatDecimal(sectionTotal, language);
    
    // Get currency from localStorage
    const organizationCurrency = localStorage.getItem('organizationCurrency') || 'EGP';
    
    // Get currency symbol using the imported function
    const currencySymbol = getCurrencySymbol(organizationCurrency, language);

    return `
      <div class="section-block">
        <!-- Header for each section -->
        <div class="header">
          ${(() => {
            const showN = layout.showOrgName !== false;
            if (!showLogo && !showN) return '';
            if (!showLogo) return `<h1>${establishmentName}</h1>`;
            return layout.logoPosition === 'beside'
              ? `<div style="display:flex;align-items:center;justify-content:center;gap:8px;">${showN ? `<h1 style="margin:0;">${establishmentName}</h1>` : ''}<div>${logoImg}</div></div>`
              : `<div style="text-align:center;margin-bottom:4px;">${logoImg}</div>${showN ? `<h1>${establishmentName}</h1>` : ''}`;
          })()}
          ${isUpdatedOrder && layout.showUpdateBanner !== false ? `
          <div class="update-banner">
            <span>🔄 ${t('orderPrint.orderUpdated')}</span>
            <small>${new Date(order.updatedAt!).toLocaleString(locale, { timeZone: organizationTimezone })}</small>
          </div>` : ''}
        </div>

        <!-- Order info for each section -->
        <div class="order-info">
          <div style="margin-bottom: 2px;">
            ${(() => {
              const showNum = layout.showOrderNumber !== false;
              const showRel = layout.showRelatedBill !== false;
              const showNumLb = layout.showOrderNumberLabel !== undefined ? layout.showOrderNumberLabel === true : showNum;
              const showRelLb = layout.showRelatedBillLabel !== undefined ? layout.showRelatedBillLabel === true : showRel;
              const printNum = String(order.orderNumber || '').replace(/^#/, '').replace(/^.*-/, '') || order.orderNumber || '';
              const bn = billNum ? String(billNum).replace(/^#/, '').replace(/^.*-/, '') : '';
              if (!showNum && !(showRel && bn) && !showNumLb && !(showRelLb && bn)) return '';
              return `<div class="info" style="display:flex;justify-content:space-between;align-items:center;gap:6px;font-weight:900;margin:2px 0;"><span>${(showNum || showNumLb) ? `<span class="order-number" style="font-weight:700;">${showNumLb ? `<span class="order-number-label">${t('orderPrint.orderNumber')}:</span> ` : ''}${showNum ? `<span class="order-number-value">${printNum}</span>` : ''}</span>` : ''}</span><span>${(showRel && bn) || (showRelLb && bn) ? `<span class="related-bill">${showRelLb ? `<span class="related-bill-label">${t('orderPrint.relatedBill')}:</span> ` : ''}${showRel && bn ? `<span class="related-bill-value">${bn}</span>` : ''}</span>` : ''}</span></div>`;
            })()}
            ${(() => {
              const sd = layout.showDate !== false;
              const st = layout.showTime !== false;
              const sdLb = layout.showDateLabel !== undefined ? layout.showDateLabel === true : sd;
              const stLb = layout.showTimeLabel !== undefined ? layout.showTimeLabel === true : st;
              if (!sd && !st && !sdLb && !stLb) return '';
              let ts = order.createdAt ? new Date(order.createdAt) : now;
              if (isNaN(ts.getTime())) ts = now;
              return `<div class="info" style="display:flex;justify-content:space-between;align-items:center;gap:6px;font-weight:900;font-size:1.15em;margin:2px 0;"><span>${(sd || sdLb) ? `<span class="order-date">${sdLb ? `<span class="order-date-label">${t('orderPrint.date')}:</span> ` : ''}${sd ? `<span class="order-date-value">${ts.toLocaleDateString(locale, { timeZone: organizationTimezone, year: 'numeric', month: '2-digit', day: '2-digit' })}</span>` : ''}</span>` : ''}</span><span>${(st || stLb) ? `<span class="order-time">${stLb ? `<span class="order-time-label">${t('orderPrint.time')}:</span> ` : ''}${st ? `<span class="order-time-value">${ts.toLocaleTimeString(locale, { timeZone: organizationTimezone, hour: '2-digit', minute: '2-digit', hour12: true })}</span>` : ''}</span>` : ''}</span></div>`;
            })()}
            ${(() => {
              const showTag = layout.showFulfillmentBadge !== false;
              const showTagLb = layout.showFulfillmentBadgeLabel !== undefined ? layout.showFulfillmentBadgeLabel === true : showTag;
              let nm = ''; try { nm = (getCurrentUserCache() as any)?.name || ''; } catch {}
              const showU = layout.showUser !== false && !!nm;
              const showULb = layout.showUserLabel !== undefined ? layout.showUserLabel === true : showU;
              if (!showTag && !showU && !showTagLb && !showULb) return '';
              const tag = order.fulfillmentType === 'delivery' ? 'دليفري' : order.fulfillmentType === 'takeaway' ? 'تيك أوي' : 'صالة';
              return `<div class="info" style="display:flex;justify-content:space-between;align-items:center;gap:6px;font-weight:900;font-size:1.15em;margin:2px 0;"><span>${(showTag || showTagLb) ? `<span class="fulfill-badge">${showTagLb ? `<span class="order-type-label">${t('orderPrint.fulfillmentType')}:</span> ` : ''}${showTag ? `<span class="order-type-value">${tag}</span>` : ''}</span>` : ''}</span><span>${(showU || showULb) ? `<span class="order-user">${showULb ? `<span class="order-user-label">${t('orderPrint.user')}:</span> ` : ''}${showU ? `<span class="order-user-value">${nm}</span>` : ''}</span>` : ''}</span></div>`;
            })()}
            ${order.fulfillmentType !== 'delivery' && order.fulfillmentType !== 'takeaway' && order.table?.number && layout.showTable !== false ? `
              <div class="info" style="font-size: 1.15em; font-weight: 900; margin: 2px 0; text-align: center;">
                ${t('orderPrint.table')}: <strong style="font-size: 1.3em;">${order.table.number}${(order.table as any)?.name && String((order.table as any).name) !== String(order.table.number) ? ` (${(order.table as any).name})` : ''}${tableSectionName ? ` — (${tableSectionName})` : ''}</strong>
              </div>
            ` : (() => {
              const nm = order.customerName || '';
              const ph = order.customerPhone || '';
              if (order.fulfillmentType === 'delivery') {
                if (!(nm || ph) || layout.showCustomer === false) return '';
                const showN = !!nm && layout.showCustName !== false;
                const showP = !!ph && layout.showPhone !== false;
                const showNLb = !!nm && (layout.showCustNameLabel !== undefined ? layout.showCustNameLabel === true : showN);
                const showPLb = !!ph && (layout.showPhoneLabel !== undefined ? layout.showPhoneLabel === true : showP);
                if (!showN && !showP && !showNLb && !showPLb) return '';
                return `<div class="info" style="display:flex;justify-content:space-between;align-items:center;gap:6px;font-weight:900;font-size:1.15em;margin:2px 0;"><span>${(showN || showNLb) ? `${showNLb ? `<span class="order-custname-label">${t('orderPrint.customer')}:</span> ` : ''}${showN ? `<span class="cust-name">${nm}</span>` : ''}` : ''}</span><span>${(showP || showPLb) ? `${showPLb ? `<span class="order-phone-label">${t('orderPrint.customerPhone')}:</span> ` : ''}${showP ? `<span class="cust-phone">${ph}</span>` : ''}` : ''}</span></div>`;
              }
              if (!(nm || ph) || layout.showCustomer === false) return '';
              const showN3 = layout.showCustName !== false;
              const showN3Lb = layout.showCustNameLabel !== undefined ? layout.showCustNameLabel === true : showN3;
              const showPL3 = !!ph && layout.showPhone !== false;
              const showPL3Lb = !!ph && (layout.showPhoneLabel !== undefined ? layout.showPhoneLabel === true : showPL3);
              return `<div class="info" style="font-size: 1.15em; font-weight: 900; margin: 2px 0; text-align: center;">${showN3Lb ? `<span class="order-custname-label">${t('orderPrint.customer')}:</span> ` : ''}${showN3 ? `<span class="cust-name">${nm}</span>` : ''}${(showPL3 || showPL3Lb) ? ` ${showPL3Lb ? `<span class="order-phone-label">${t('orderPrint.customerPhone')}:</span> ` : ''}${showPL3 ? `<span class="cust-phone">— ${ph}</span>` : ''}` : ''}</div>`;
            })()}
            ${(() => { const ad = order.fulfillmentType === 'delivery' ? (order as any).deliveryAddress : ''; if (!ad) return ''; const shA = layout.showAddress !== false; const shALb = layout.showAddressLabel !== undefined ? layout.showAddressLabel === true : shA; if (!shA && !shALb) return ''; return `<div class="info delivery-address" style="font-weight: 900; font-size: 1em;">📍 ${shALb ? `<span class="order-address-label">${t('orderPrint.customerAddress')}:</span> ` : ''}${shA ? `<span class="order-address-value">${ad}</span>` : ''}</div>`; })()}
          </div>
        </div>

        <!-- Section name -->
        ${layout.showSectionTitle !== false ? `
        <div class="section-name" style="font-size: 1.15em; font-weight: 800;">
          ${t('orderPrint.section')}: ${sectionName}
        </div>` : ''}

        <!-- Items table -->
        <table class="items">
          <thead>
            <tr>
              <th class="item-name">${t('orderPrint.item')}</th>
              <th class="item-qty">${t('orderPrint.quantity')}</th>
              ${showPrice ? `<th class="item-price">${t('orderPrint.price', 'السعر')}</th>` : ''}
              ${showTotal ? `<th class="item-total">${t('orderPrint.total', 'الإجمالي')}</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${items.map(item => {
              const v = (item as any).variant;
              const variantText = v && v !== 'عادي' ? ` (${v})` : '';
              const lineTotal = (Number(item.price) || 0) * (Number(item.quantity) || 0);
              return `
              <tr>
                <td class="item-name">${item.name}${variantText}${item.notes && layout.showItemNotes !== false ? `<br><small>(${item.notes})</small>` : ''}</td>
                <td class="item-qty"><strong>${formatDecimal(item.quantity, language)}</strong></td>
                ${showPrice ? `<td class="item-price">${formatDecimal(item.price, language)}</td>` : ''}
                ${showTotal ? `<td class="item-total"><strong>${formatDecimal(lineTotal, language)}</strong></td>` : ''}
              </tr>
              ${item.addons && item.addons.length > 0 ?
                item.addons.map(addon => `
                  <tr>
                    <td class="item-name" style="padding-${align}: 15px;">+ ${addon.name}</td>
                    <td class="item-qty"><strong>${formatDecimal(addon.quantity, language)}</strong></td>
                    ${showPrice ? `<td class="item-price">${formatDecimal(addon.price, language)}</td>` : ''}
                    ${showTotal ? `<td class="item-total">${formatDecimal((Number(addon.price) || 0) * (Number(addon.quantity) || 0), language)}</td>` : ''}
                  </tr>
                `).join('') : ''
              }
            `;
            }).join('')}
          </tbody>
        </table>

        <!-- Section total -->
        ${layout.showSectionTotal !== false ? `
        <div class="total">
          ${t('orderPrint.sectionTotal')}: <strong>${formattedTotal}</strong> ${currencySymbol}
        </div>` : ''}

        <!-- Order notes if exist -->
        ${order.notes && layout.showOrderNotes !== false ? `
          <div class="notes">
            <strong>${t('orderPrint.notes')}:</strong> ${order.notes}
          </div>
        ` : ''}

        ${extra?.customFooter && layout.showThanks !== false ? `
        <div class="thank-you">${extra.customFooter}</div>` : ''}

        <!-- توقيع المطور — ثابت دائماً وغير قابل للإخفاء -->
        <div class="dev-sign" style="margin-top:3px;padding-top:3px;font-size:1.15em;line-height:1.1;text-align:center;font-weight:bold;border-top:2px dashed #000;">
          <strong>${t('orderPrint.footer')}</strong>
        </div>
      </div>
    `;
  }).join('');

  const printContent = `
<!DOCTYPE html>
<html dir="${dir}">
<head>
<meta charset="UTF-8">
<title>${t('orderPrint.printButton')} #${getDisplayNumber(order.orderNumber)}</title>

<style>${layoutCss(layout, 'order')}
@import url('https://fonts.googleapis.com/css2?family=${printFontImport(printFont)}&display=swap');
html { width: 100%; max-width: 100%; overflow-x: hidden; }
* {
  font-family: '${printFont}', sans-serif;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  box-sizing: border-box;
}

/* ===== BODY (bill-like) ===== */
body {
  margin: 0;
  padding: 0;
  font-size: 11px;
  color: #000;
  font-weight: 600;
  width: 100%;
  max-width: 100%;
  text-align: center;
  direction: ${dir};
  box-sizing: border-box;
  word-wrap: break-word;
  overflow-x: hidden;
  overflow-wrap: anywhere;
  word-break: break-word;
}
strong {
  font-weight: 800;
}

/* ===== HEADER (bill-like, بلا خط سفلي) ===== */
.header {
  text-align: center;
  margin-bottom: 8px;
  margin-top: 0;
  font-weight: 700;
  padding-bottom: 6px;
}

/* ===== SECTIONS ===== */
.section-block {
  margin: 0;
  padding-bottom: 2px;
  border-bottom: 2px dashed #000;
}

.section-name {
  font-size: 1.5em;
  font-weight: 800;
  margin: 1px 0 1px 0;
  text-align: center;
  background: #e0e0e0;
  padding: 2px;
  border-radius: 1px;
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

/* ===== ORDER INFO (bill-like) ===== */
.order-info {
  margin-bottom: 2px;
  font-weight: 600;
  font-size: 0.9em;
  text-align: center;
}

/* ===== TABLE (bill-like) ===== */
.items {
  width: 100%;
  border-collapse: collapse;
  margin: 1px 0;
  font-size: 1.05em;
  border: 1px solid #000;
  table-layout: fixed;
  text-align: center;
  direction: ${dir};
}

.items thead {
  background: #e0e0e0;
  font-weight: 800;
}

.items th,
.items td {
  padding: 1px 0;
  text-align: center;
  border: 1px solid #000;
  font-weight: 900;
  vertical-align: middle;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.items th {
  font-size: 1.1em;
}

/* ===== TABLE CELLS (bill-like) ===== */
.item-name {
  width: 70%;
  text-align: center;
  padding: 1px 0;
  font-weight: 900;
  font-size: 1.2em;
  white-space: pre-wrap;
  word-break: break-word;
}

.item-qty {
  width: 30%;
  text-align: center;
  padding: 1px 0;
  font-weight: 900;
  font-size: 1.25em;
}

/* ===== ITEM NOTES ===== */
.item-notes {
  font-size: 0.85em;
  color: #666;
  margin: 2px auto 0;
  padding: 0 4px;
  max-width: 100%;
  text-align: center;
  font-style: italic;
}

/* ===== TOTAL (Section Total, bill-like) ===== */
.total {
  text-align: center;
  padding: 2px 2px;
  margin-bottom: 2px;
  font-size: 1.2em;
  font-weight: 800;
}

/* ===== NOTES (bill-like) ===== */
.notes {
  margin-top: 2px;
  font-size: 0.9em;
  font-weight: 700;
  padding: 0 2px;
  text-align: center;
}

/* ===== FOOTER (bill-like) ===== */
.footer {
  margin-top: 2px;
  text-align: center;
  font-size: 1.2em;
  color: #000;
  border-top: 2px dashed #000;
  padding-top: 2px;
  padding-bottom: 2px;
  font-weight: 900;
}

.footer strong {
  font-weight: 900;
  white-space: nowrap;
}

.thank-you {
  text-align: center;
  margin-top: 10px;
  margin-bottom: 8px;
  font-size: 1.1em;
  font-weight: 700;
}

/* ===== PRINT (bill-like) ===== */
@media print {
  @page {
    size: auto;
    margin: 0;
  }
  body {
    margin: 0;
    padding: 0;
    font-weight: 600;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow-x: hidden;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  table, img, div { max-width: 100%; box-sizing: border-box; }
  .items { table-layout: fixed; width: 100%; }
  html { width: 100%; max-width: 100%; overflow-x: hidden; }
  .items th, .items td {
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .no-print { display: none !important; }
  .items {
    border: 2px solid #000 !important;
  }
  .items th,
  .items td {
    border: 1px solid #000 !important;
  }
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .section-block {
    page-break-before: always;
    break-before: always;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .section-block:first-child {
    page-break-before: auto;
    break-before: auto;
  }
}

@media screen {
  body {
    max-width: 100%;
    margin: 0 auto;
    background: #fff;
  }
}
</style>
</head>

<body>
  ${sectionsContent}
</body>
</html>
`;

  return printContent;
};

export const printOrder = async (
  order: Order,
  menuSections: MenuSection[] = [],
  menuItemsMap: Map<string, { category?: { section?: string | MenuSection } }> = new Map(),
  fallbackOrganizationName?: string,
  language: string = 'ar',
  t: TFunction = ((key: string) => key) as TFunction,
  tableSectionName?: string,
  selectedSectionIds?: string[],
  printerName?: string,
  paperWidthMm?: number,
  copies: number = 1,
  extra?: { logoUrl?: string; layout?: DocPrintLayout; printFont?: string; customFooter?: string; copyPrinters?: Array<string | undefined>; defaultPrinter?: string }
) => {
  // ⚡ إشعار فوري: الطباعة بدأت لحظة الضغط.
  try {
    const startingMsg = language === 'ar' ? 'جارٍ طباعة الطلب...' : language === 'fr' ? 'Impression en cours...' : 'Printing order...';
    if (typeof window !== 'undefined' && (window as any).showNotification) (window as any).showNotification(startingMsg, 'info');
  } catch {}
  if (isMobileDevice()) {
    // Phones have no local print agent: execute on the MAIN device instead.
    // FAST PATH: zero pre-fetches — the order already carries its
    // organization, and the server resolves settings itself.
    // NOTE: (window as any).showNotification is never assigned anywhere, so
    // use real toasts here — otherwise failures are completely silent.
    const tError = (msg: string) => { try { toast.error(msg); } catch {} };
    const tSuccess = (msg: string) => { try { toast.success(msg); } catch {} };
    const tInfo = (msg: string) => { try { toast.info(msg); } catch {} };
    try {
      tInfo(language === 'ar' ? 'جارٍ إرسال الطلب للجهاز الرئيسي...' : 'Sending order to the main device...');
      let orgHint: any = (order as any)?.organization || null;
      if (!orgHint) {
        const orgRes: any = await Promise.race([
          api.getOrganization().catch(() => null),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
        ]).catch(() => null);
        orgHint = orgRes?.success ? orgRes.data : null;
      }
      // Split by sections so each gets its own print page + cut, like the desktop path.
      const phoneSections = selectedSectionIds && selectedSectionIds.length > 1
        ? selectedSectionIds
        : [undefined];
      let lastRes: any = null;
      await Promise.all(phoneSections.map(async (sectionId) => {
        let orderHtmlForRelay: string | undefined;
        try {
          orderHtmlForRelay = await buildOrderPrintHTML(
            order,
            menuSections,
            menuItemsMap,
            fallbackOrganizationName,
            language,
            t,
            tableSectionName,
            sectionId ? [sectionId] : selectedSectionIds,
            extra,
          );
        } catch (e) {
          console.warn('[printOrder] relay HTML build failed, server will use RAW fallback:', e);
        }
        const payload = {
          order,
          organization: orgHint,
          language,
          html: orderHtmlForRelay,
          printerName,
          paperWidthMm,
          copies,
          copyPrinters: extra?.copyPrinters,
          printKey: `order:${(order as any)?._id || (order as any)?.orderNumber || ''}:${sectionId || 'all'}`,
        };
        let res: any = await api.printOrder(payload);
        if (!res?.success) {
          try {
            res = await api.autoDetectAndPrintOrder(payload);
          } catch {}
        }
        lastRes = res;
      }));
      if (lastRes?.success) {
        tSuccess(language === 'ar' ? 'تم إرسال الطلب للطباعة على الجهاز الرئيسي' : language === 'fr' ? 'Commande envoyée à l\u2019imprimante principale' : 'Order sent to the main device printer');
      } else {
        tError(lastRes?.message || (language === 'ar' ? 'فشلت الطباعة على الجهاز الرئيسي — تأكد من توصيل الطابعة بالجهاز الرئيسي' : 'Server print failed — check the printer on the main device'));
      }
    } catch {
      tError(language === 'ar' ? 'تعذر الاتصال بالجهاز الرئيسي' : 'Main device unreachable');
    }
    return;
  }
  const savedPrinter = printerName ? null : await getCachedDevicePrinter();
  const selectedPrinterName = printerName || extra?.defaultPrinter || savedPrinter?.data?.printerName || savedPrinter?.data?.name;
  const sectionsToPrint = selectedSectionIds && selectedSectionIds.length > 1
    ? selectedSectionIds
    : [undefined];
  await Promise.all(sectionsToPrint.map(async (sectionId) => {
    const printContent = await buildOrderPrintHTML(
      order,
      menuSections,
      menuItemsMap,
      fallbackOrganizationName,
      language,
      t,
      tableSectionName,
      sectionId ? [sectionId] : selectedSectionIds,
      extra,
    );
    return printThroughLocalBridge(printContent, selectedPrinterName, { cutPaper: true, paperWidthMm, copies, copyPrinters: extra?.copyPrinters });
  }));
};

export default printOrder;
