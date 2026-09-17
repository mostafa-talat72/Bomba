/**
 * Canonical inventory values (Arabic) — stored as-is in the DB, translated for display only.
 * Prevents DB pollution with translated (EN/FR) values when saving in any language.
 * Used by Inventory.tsx and Warehouse.tsx.
 */

export const UNIT_CANONICAL = ['قطعة', 'كيلو', 'جرام', 'لتر', 'مل', 'علبة', 'كيس', 'زجاجة'];
export const UNIT_LABEL_KEYS = [
  'inventory.units.piece', 'inventory.units.kilo', 'inventory.units.gram', 'inventory.units.liter',
  'inventory.units.ml', 'inventory.units.box', 'inventory.units.bag', 'inventory.units.bottle',
];
export const CATEGORY_CANONICAL = ['مشروبات ساخنة', 'مشروبات باردة', 'طعام', 'حلويات', 'مواد خام', 'أخرى'];
export const CATEGORY_LABEL_KEYS = [
  'inventory.categories.hotDrinks', 'inventory.categories.coldDrinks', 'inventory.categories.food',
  'inventory.categories.desserts', 'inventory.categories.rawMaterials', 'inventory.categories.other',
];
// Any value in any language → canonical Arabic (covers old polluted rows too)
export const UNIT_TO_AR: Record<string, string> = {
  'قطعة': 'قطعة', 'كيلو': 'كيلو', 'جرام': 'جرام', 'لتر': 'لتر',
  'مل': 'مل', 'علبة': 'علبة', 'كيس': 'كيس', 'زجاجة': 'زجاجة',
  'Piece': 'قطعة', 'Kilo': 'كيلو', 'Gram': 'جرام', 'Liter': 'لتر',
  'ML': 'مل', 'Box': 'علبة', 'Bag': 'كيس', 'Bottle': 'زجاجة',
  'piece': 'قطعة', 'kilo': 'كيلو', 'gram': 'جرام', 'liter': 'لتر',
  'ml': 'مل', 'box': 'علبة', 'bag': 'كيس', 'bottle': 'زجاجة',
  'Pièce': 'قطعة', 'Gramme': 'جرام', 'Litre': 'لتر',
  'Boîte': 'علبة', 'Sac': 'كيس', 'Bouteille': 'زجاجة',
};
export const CATEGORY_TO_AR: Record<string, string> = {
  'مشروبات ساخنة': 'مشروبات ساخنة', 'مشروبات باردة': 'مشروبات باردة', 'طعام': 'طعام',
  'حلويات': 'حلويات', 'مواد خام': 'مواد خام', 'أخرى': 'أخرى',
  'Hot Drinks': 'مشروبات ساخنة', 'Cold Drinks': 'مشروبات باردة', 'Food': 'طعام',
  'Desserts': 'حلويات', 'Raw Materials': 'مواد خام', 'Other': 'أخرى',
  'Boissons chaudes': 'مشروبات ساخنة', 'Boissons froides': 'مشروبات باردة', 'Nourriture': 'طعام',
  'Matières premières': 'مواد خام', 'Autre': 'أخرى',
};
export const REASON_TO_AR: Record<string, string> = {
  'بيع': 'بيع', 'استهلاك في الإنتاج': 'استهلاك في الإنتاج', 'تالف': 'تالف',
  'منتهي الصلاحية': 'منتهي الصلاحية', 'إرجاع للمورد': 'إرجاع للمورد',
  'جرد دوري': 'جرد دوري', 'تصحيح خطأ': 'تصحيح خطأ', 'فقدان': 'فقدان',
  'شراء مخزون جديد': 'شراء مخزون جديد', 'المخزون الأولي': 'المخزون الأولي',
  'تحويل من المخزن الرئيسي': 'تحويل من المخزن الرئيسي', 'نقل إلى المخزون الحالي': 'تحويل من المخزن الرئيسي',
  'إرجاع إلى المخزن الرئيسي': 'إرجاع إلى المخزن الرئيسي', 'إرجاع من المخزون الحالي': 'إرجاع إلى المخزن الرئيسي',
  'Sale': 'بيع', 'Production Consumption': 'استهلاك في الإنتاج', 'Damaged': 'تالف',
  'Expired': 'منتهي الصلاحية', 'Return to Supplier': 'إرجاع للمورد',
  'Periodic Inventory': 'جرد دوري', 'Error Correction': 'تصحيح خطأ', 'Loss': 'فقدان',
  'New stock purchase': 'شراء مخزون جديد', 'Initial stock': 'المخزون الأولي',
  'Transfer from Main Warehouse': 'تحويل من المخزن الرئيسي',
  'Return to Main Warehouse': 'إرجاع إلى المخزن الرئيسي',
  'Vente': 'بيع', 'Consommation de production': 'استهلاك في الإنتاج', 'Endommagé': 'تالف',
  'Expiré': 'منتهي الصلاحية', 'Retour au fournisseur': 'إرجاع للمورد',
  'Inventaire périodique': 'جرد دوري', "Correction d'erreur": 'تصحيح خطأ', 'Perte': 'فقدان',
  'Achat de nouveau stock': 'شراء مخزون جديد', 'Stock initial': 'المخزون الأولي',
  "Transfert depuis l'Entrepôt Principal": 'تحويل من المخزن الرئيسي',
  "Retour à l'Entrepôt Principal": 'إرجاع إلى المخزن الرئيسي',
};
export const TRANSFER_REASON_AR = 'تحويل من المخزن الرئيسي';
export const RETURN_REASON_AR = 'إرجاع إلى المخزن الرئيسي';

export const toCanonicalUnit = (u: string): string => (!u ? '' : (UNIT_TO_AR[u] || u));
export const toCanonicalCategory = (c: string): string => (!c ? '' : (CATEGORY_TO_AR[c] || c));
export const toCanonicalReason = (r: string): string => (!r ? '' : (REASON_TO_AR[r] || r));

/** Order/invoice-linked movement in any language (protected from edit/delete) */
export const isOrderLinkedReason = (reason?: string): boolean =>
  !!reason && /طلب|فاتورة|order|invoice|commande|facture/i.test(reason);
