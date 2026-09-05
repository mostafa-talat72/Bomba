import api from '../services/api';
import { formatDecimal, getCurrencySymbol, getDisplayNumber } from './formatters';
import type { TFunction } from 'i18next';
import { getCachedDevicePrinter, printThroughLocalBridge } from './localPrintBridge';

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
  items: OrderItem[];
  totalAmount?: number;
  finalAmount?: number;
  notes?: string;
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
  selectedSectionIds?: string[]
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
      // If organization is just a string ID, try to fetch data
      try {
        const response = await fetch(`/api/organization/${org}`);
        if (response.ok) {
          const orgData = await response.json();
          if (orgData.success && orgData.data?.name) {
            establishmentName = orgData.data.name;
          }
        }
      } catch (error) {
        console.warn('Failed to fetch organization name for order:', error);
        // Use fallback name in case of failure
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

  order.items.forEach(item => {
    // Get menu section for item
    let sectionId: string | null = null;
    let sectionName: string | null = null;

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
        )?.name || t('orderPrint.unspecifiedSection');
    
    return { sectionId, sectionName, items };
  });

  // Print all sections on one page using iframe
  return printAllSectionsInOnePage(order, sectionsArray, establishmentName, language, t, tableSectionName);
};

// Function to print all sections on one page using iframe
const printAllSectionsInOnePage = (
  order: Order,
  sections: Array<{ sectionId: string; sectionName: string; items: OrderItem[] }>,
  establishmentName: string,
  language: string,
  t: TFunction,
  tableSectionName?: string
) => {
  const now = new Date();
  const locale = language === 'ar' ? 'ar-EG' : language === 'fr' ? 'fr-FR' : 'en-US';
  const organizationTimezone = localStorage.getItem('organizationTimezone') || 'Africa/Cairo';
  const dateTimeString = now.toLocaleString(locale, {
    timeZone: organizationTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const isUpdatedOrder = order.updatedAt && 
    new Date(order.updatedAt).getTime() > new Date(order.createdAt).getTime();

  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const align = language === 'ar' ? 'right' : 'left';

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
          <h1>${establishmentName}</h1>
          ${isUpdatedOrder ? `
          <div class="update-banner">
            <span>🔄 ${t('orderPrint.orderUpdated')}</span>
            <small>${new Date(order.updatedAt!).toLocaleString(locale, { timeZone: organizationTimezone })}</small>
          </div>` : ''}
        </div>

        <!-- Order info for each section -->
        <div class="order-info">
          <div style="margin-bottom: 2px;">
            <div style="font-size: 22px; font-weight: 900; margin: 2px 0;"><strong>${getDisplayNumber(order.orderNumber)}</strong></div>
            <div style="font-size: 1.15em; font-weight: 900; color: #333; margin: 2px 0;">${dateTimeString}</div>
            ${order.table?.number ? `
              <div style="font-size: 1.15em; font-weight: 900; margin: 2px 0; text-align: center;">
                ${t('orderPrint.table')}: <strong style="font-size: 1.3em;">${order.table.number}</strong>${tableSectionName ? `—(${tableSectionName})` : ''}
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Section name -->
        <div class="section-name" style="font-size: 1.15em; font-weight: 800;">
          ${t('orderPrint.section')}: ${sectionName}
        </div>

        <!-- Items table -->
        <table class="items">
          <thead>
            <tr>
              <th class="item-name">${t('orderPrint.item')}</th>
              <th class="item-qty">${t('orderPrint.quantity')}</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => {
              const v = (item as any).variant;
              const variantText = v && v !== 'عادي' ? ` (${v})` : '';
              return `
              <tr>
                <td class="item-name">${item.name}${variantText}${item.notes ? `<br><small>(${item.notes})</small>` : ''}</td>
                <td class="item-qty"><strong>${formatDecimal(item.quantity, language)}</strong></td>
              </tr>
              ${item.addons && item.addons.length > 0 ?
                item.addons.map(addon => `
                  <tr>
                    <td class="item-name" style="padding-${align}: 15px;">+ ${addon.name}</td>
                    <td class="item-qty"><strong>${formatDecimal(addon.quantity, language)}</strong></td>
                  </tr>
                `).join('') : ''
              }
            `;
            }).join('')}
          </tbody>
        </table>

        <!-- Section total -->
        <div class="total">
          ${t('orderPrint.sectionTotal')}: <strong>${formattedTotal}</strong> ${currencySymbol}
        </div>

        <!-- Order notes if exist -->
        ${order.notes ? `
          <div class="notes">
            <strong>${t('orderPrint.notes')}:</strong> ${order.notes}
          </div>
        ` : ''}

        <!-- Footer for each section -->
        <div class="footer">
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

<style>
html {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  box-sizing: border-box;
}

@page {
  size: auto;
  margin: 0;
}

/* ===== BODY ===== */
body {
  direction: ${dir};
  font-family: 'Arial', sans-serif;
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  padding: 0;
  background: white;
  color: #000;
  font-size: 15px;
  line-height: 1;
  box-sizing: border-box;
  word-wrap: break-word;
  overflow-x: hidden;
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* ===== HEADER ===== */
.header {
  text-align: center;
  margin: 1px auto;
  padding: 1px 0;
}

.header h1 {
  font-size: 18px;
  margin: 0;
  padding: 6px 0 4px;
}

/* ===== SECTIONS ===== */
.section-block {
  margin: 0;
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
  margin-top: 1px;عح
}

/* ===== ORDER INFO ===== */
.order-info {
  margin-bottom: 2px;
  padding-bottom: 2px;
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
  margin: 2px 0;
  table-layout: fixed;
  text-align: center;
  direction: ${dir};
  border: 1.5px solid #000;
}

.items th,
.items td {
  padding: 1px 0;
  font-size: 1.2em;
  font-weight: 900;
  border: 1px solid #000;
  text-align: center;
  vertical-align: middle;
  direction: ${dir};
  unicode-bidi: plaintext;
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* ===== TABLE CELLS ===== */
.item-name {
  width: 70%;
  text-align: center;
  padding: 1px 0;
  font-weight: 900;
  font-size: 1.05em;
}

.item-qty {
  width: 30%;
  text-align: center;
  padding: 1px 0;
  font-weight: 900;
  font-size: 1.3em;
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

/* ===== TOTAL (Section Total) ===== */
.total {
  margin: 2px auto 0;
  padding: 2px 0;
  font-size: 1.2em;
  font-weight: 900;
  text-align: center;
  background-color: #f9f9f9;
  border-radius: 4px;
}

/* ===== NOTES ===== */
.notes {
  margin-top: 2px;
  font-size: 9px;
  padding: 0 2px;
  text-align: center;
}

/* ===== FOOTER ===== */
.footer {
  margin-top: 3px;
  padding-top: 3px;
  font-size: 1.15em;
  line-height: 1.1;
  text-align: center;
  font-weight: bold;
  border-top: 1px dashed #000;
}

.footer strong {
  font-size: 1em;
  font-weight: 900;
  white-space: nowrap;
}

/* ===== PRINT ===== */
@media print {
  html, body { width: 100%; max-width: 100%; padding: 0; margin: 0; overflow-x: hidden; }
  .no-print { display: none !important; }

  .section-block {
    page-break-after: auto;
    break-after: auto;
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
  paperWidthMm?: number
) => {
  const savedPrinter = printerName ? null : await getCachedDevicePrinter();
  const selectedPrinterName = printerName || savedPrinter?.data?.printerName || savedPrinter?.data?.name;
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
    );
    return printThroughLocalBridge(printContent, selectedPrinterName, { cutPaper: true, paperWidthMm });
  }));
};

export default printOrder;
