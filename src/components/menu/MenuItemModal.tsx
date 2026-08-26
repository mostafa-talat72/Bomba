import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Plus, Trash2, ChevronLeft, ChevronRight, Utensils, Settings, FlaskConical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MenuItem, MenuCategory, MenuSection } from '../../services/api';
import { formatDecimal } from '../../utils/formatters';

interface MenuItemModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSave: (data: { name: string; price: string; category: string; description: string; isAvailable: boolean; preparationTime: string; isPopular: boolean; ingredients: { item: string; quantity: number; unit: string }[] }) => Promise<void>;
	editingItem: MenuItem | null;
	formData: {
		name: string;
		price: string;
		category: string;
		description: string;
		isAvailable: boolean;
		preparationTime: string;
		isPopular: boolean;
		ingredients: { item: string; quantity: number; unit: string }[];
	};
	setFormData: React.Dispatch<React.SetStateAction<{ name: string; price: string; category: string; description: string; isAvailable: boolean; preparationTime: string; isPopular: boolean; ingredients: { item: string; quantity: number; unit: string }[] }>>;
	menuCategories: MenuCategory[];
	menuSections: MenuSection[];
	inventoryItems: Array<{ id: string; name: string; unit: string; isRawMaterial: boolean }>;
	saving: boolean;
	unitOptions: string[];
	addIngredient: () => void;
	removeIngredient: (index: number) => void;
	updateIngredient: (index: number, field: 'item' | 'quantity' | 'unit', value: string | number) => void;
	fetchInventoryItems: () => void;
}

const MenuItemModal: React.FC<MenuItemModalProps> = ({
	isOpen,
	onClose,
	onSave,
	editingItem,
	formData,
	setFormData,
	menuCategories,
	menuSections,
	inventoryItems,
	saving,
	unitOptions,
	addIngredient,
	removeIngredient,
	updateIngredient,
	fetchInventoryItems
}) => {
	const { t, i18n } = useTranslation();
	const [currentStep, setCurrentStep] = useState(0);
	const [errors, setErrors] = useState<Record<string, string>>({});

	const steps = [
		{ title: t('menu.basicInfo'), icon: <Utensils className="h-4 w-4" /> },
		{ title: t('menu.advancedSettings'), icon: <Settings className="h-4 w-4" /> },
		{ title: t('menu.ingredientsTab'), icon: <FlaskConical className="h-4 w-4" /> }
	];

	useEffect(() => {
		if (isOpen) { setCurrentStep(0); setErrors({}); }
	}, [isOpen]);

	const validateStep = (step: number): boolean => {
		const newErrors: Record<string, string> = {};
		if (step === 0) {
			if (!formData.name.trim()) newErrors.name = t('menu.fieldRequired');
			if (!formData.price || parseFloat(formData.price) <= 0) newErrors.price = t('menu.fieldRequired');
			if (!formData.category) newErrors.category = t('menu.fieldRequired');
		}
		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleNext = () => {
		if (validateStep(currentStep)) setCurrentStep(currentStep + 1);
	};

	const getCompatibleUnits = (inventoryUnit: string) => {
		const map: Record<string, string[]> = {
			'كيلو': ['كيلو', 'جرام'], 'جرام': ['جرام', 'كيلو'],
			'لتر': ['لتر', 'مل'], 'مل': ['مل', 'لتر'],
			'قطعة': ['قطعة'], 'علبة': ['علبة'], 'كيس': ['كيس'], 'زجاجة': ['زجاجة']
		};
		return map[inventoryUnit] || [inventoryUnit];
	};

	if (!isOpen) return null;

	return (
		<div className="modal-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
			<div className="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-700">
				{/* Header */}
				<div className="sticky top-0 bg-gradient-to-r from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700 px-6 py-4 rounded-t-2xl shadow-lg z-10">
					<div className="flex items-center justify-between mb-3">
						<h3 className="text-xl font-bold text-white">{editingItem ? t('menu.editItemTitle') : t('menu.addNewItem')}</h3>
						<button onClick={onClose} className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all"><X className="h-5 w-5" /></button>
					</div>
					<div className="flex items-center gap-1">
						{steps.map((step, index) => (
							<button key={index} onClick={() => setCurrentStep(index)}
								className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${currentStep === index ? 'bg-white text-orange-600' : 'bg-white/20 text-white hover:bg-white/30'}`}>
								{step.icon}
								<span className="hidden sm:inline">{step.title}</span>
							</button>
						))}
					</div>
				</div>

				{/* Content */}
				<div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
					{currentStep === 0 && (
						<div className="space-y-5">
							<div>
								<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('menu.itemNameLabel')} <span className="text-red-500">*</span></label>
								<input type="text" value={formData.name} onChange={(e) => { setFormData({ ...formData, name: e.target.value }); if (errors.name) setErrors(prev => { const n = { ...prev }; delete n.name; return n; }); }}
									className={`w-full border-2 rounded-xl px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 transition-all ${errors.name ? 'border-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-orange-500'}`} placeholder={t('menu.itemNamePlaceholder')} autoFocus />
								{errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('menu.priceEGP')} <span className="text-red-500">*</span></label>
									<input type="number" value={formData.price} onChange={(e) => { setFormData({ ...formData, price: e.target.value }); if (errors.price) setErrors(prev => { const n = { ...prev }; delete n.price; return n; }); }}
										className={`w-full border-2 rounded-xl px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 transition-all ${errors.price ? 'border-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-orange-500'}`} placeholder="0.00" min="0" step="0.01" />
									{errors.price && <p className="text-red-500 text-xs mt-1">{errors.price}</p>}
								</div>
								<div>
									<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('menu.preparationTimeMinutes')}</label>
									<input type="number" value={formData.preparationTime} onChange={(e) => setFormData({ ...formData, preparationTime: e.target.value })}
										className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all" min="1" max="60" />
								</div>
							</div>
							<div>
								<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('menu.category')} <span className="text-red-500">*</span></label>
								<select value={formData.category} onChange={(e) => { setFormData({ ...formData, category: e.target.value }); if (errors.category) setErrors(prev => { const n = { ...prev }; delete n.category; return n; }); }}
									className={`w-full border-2 rounded-xl px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 transition-all ${errors.category ? 'border-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-orange-500'}`}>
									<option value="">{t('menu.selectCategory')}</option>
									{menuCategories.map(cat => {
										const sName = typeof cat.section === 'string' ? menuSections.find(s => s.id === cat.section)?.name || '' : (cat.section as MenuSection)?.name || '';
										return <option key={cat.id} value={cat.id}>{sName ? `${sName} - ` : ''}{cat.name}</option>;
									})}
								</select>
								{errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
							</div>
							<div>
								<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('menu.description')}</label>
								<textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
									className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all" rows={3} placeholder={t('menu.descriptionPlaceholder')} />
							</div>
						</div>
					)}

					{currentStep === 1 && (
						<div className="space-y-5">
							<div className="grid grid-cols-2 gap-4">
								<label className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
									<input type="checkbox" checked={formData.isAvailable} onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
										className="h-5 w-5 text-orange-600 focus:ring-orange-500 border-gray-300 dark:border-gray-600 rounded" />
									<div>
										<span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('menu.availableForOrder')}</span>
										<p className="text-xs text-gray-500 dark:text-gray-400">{formData.isAvailable ? '✓ ' + t('menu.available') : '✗ ' + t('menu.unavailable')}</p>
									</div>
								</label>
								<label className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
									<input type="checkbox" checked={formData.isPopular} onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
										className="h-5 w-5 text-orange-600 focus:ring-orange-500 border-gray-300 dark:border-gray-600 rounded" />
									<div>
										<span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('menu.popularItem')}</span>
									</div>
								</label>
							</div>
							<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
								<h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">{t('menu.tips')}</h4>
								<ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
									<li>• {t('menu.tipAvailable')}</li>
									<li>• {t('menu.tipPopular')}</li>
									<li>• {t('menu.tipPrepTime')}</li>
								</ul>
							</div>
						</div>
					)}

					{currentStep === 2 && (
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
									{t('menu.ingredientsLinked')}
									<span className="text-xs text-gray-500 dark:text-gray-400 mr-2 font-normal">
										({(() => {
											const raw = inventoryItems.filter(i => i.isRawMaterial);
											const sel = formData.ingredients.map(i => i.item).filter(i => i !== '');
											const avail = raw.filter(i => !sel.includes(i.id));
											return `${formatDecimal(avail.length, i18n.language)} ${t('menu.of')} ${formatDecimal(raw.length, i18n.language)} ${t('menu.availableRawMaterials')}`;
										})()})
									</span>
								</label>
								{inventoryItems.length === 0 && (
									<button type="button" onClick={() => fetchInventoryItems()} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">
										{t('menu.updateIngredients')}
									</button>
								)}
							</div>
							<div className="space-y-3 max-h-60 overflow-y-auto">
								{formData.ingredients.map((ingredient, index) => (
									<div key={index} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
										<div className="flex-1">
											<label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">{t('menu.ingredients')}</label>
											<select value={ingredient.item} onChange={(e) => updateIngredient(index, 'item', e.target.value)}
												className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm">
												<option value="">{t('menu.selectIngredient')}</option>
												{inventoryItems.filter(i => i.isRawMaterial && !formData.ingredients.some((ing, idx) => idx !== index && ing.item === i.id)).map(i => (
													<option key={i.id} value={i.id}>{i.name}</option>
												))}
											</select>
										</div>
										<div className="w-24">
											<label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">{t('menu.quantity')}</label>
											<input type="number" value={ingredient.quantity} onChange={(e) => updateIngredient(index, 'quantity', parseFloat(e.target.value) || 0)}
												className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm" min="0" step="0.1" />
										</div>
										<div className="w-24">
											<label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">{t('menu.unit')}</label>
											<select value={ingredient.unit} onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
												className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm">
												{(() => {
													const inv = inventoryItems.find(i => i.id === ingredient.item);
													if (inv) return getCompatibleUnits(inv.unit).map(u => <option key={u} value={u}>{u}</option>);
													return unitOptions.map(u => <option key={u} value={u}>{u}</option>);
												})()}
											</select>
										</div>
										<button type="button" onClick={() => removeIngredient(index)} className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors self-end">
											<Trash2 className="h-4 w-4" />
										</button>
									</div>
								))}
								{(() => {
									const raw = inventoryItems.filter(i => i.isRawMaterial);
									const sel = formData.ingredients.map(i => i.item).filter(i => i !== '');
									const avail = raw.filter(i => !sel.includes(i.id));
									if (avail.length === 0 && raw.length > 0) {
										return <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-600 rounded-lg p-3 text-center text-sm text-yellow-800 dark:text-yellow-200">{t('menu.allIngredientsSelected')}</div>;
									}
									if (raw.length === 0) {
										return <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-600 rounded-lg p-3 text-center text-sm text-blue-800 dark:text-blue-200">{t('menu.addIngredientsFirst')}</div>;
									}
									return (
										<button type="button" onClick={addIngredient} className="w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-orange-500 dark:hover:border-orange-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors flex items-center justify-center">
											<Plus className="h-4 w-4 ml-2" />{t('menu.addIngredient')}
										</button>
									);
								})()}
							</div>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="sticky bottom-0 bg-gray-50 dark:bg-gray-800 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
					<div className="flex items-center gap-2">
						{currentStep > 0 && (
							<button onClick={() => setCurrentStep(currentStep - 1)} className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg transition-all flex items-center gap-1 text-sm">
								<ChevronRight className="h-4 w-4" />{t('menu.previous')}
							</button>
						)}
					</div>
					<div className="flex items-center gap-3">
						<button onClick={onClose} className="px-6 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-all font-medium">{t('common.cancel')}</button>
						{currentStep < steps.length - 1 ? (
							<button onClick={handleNext} className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-all flex items-center gap-2 font-medium shadow-md hover:shadow-lg">
								{t('menu.next')}<ChevronLeft className="h-5 w-5" />
							</button>
						) : (
							<button onClick={() => onSave(formData)} disabled={saving}
								className="px-8 py-3 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-md hover:shadow-lg">
								{saving ? <><div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div><span>{t('menu.saving')}</span></>
									: <><CheckCircle className="h-5 w-5" /><span>{editingItem ? t('common.saveChanges') : t('common.save')}</span></>}
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default MenuItemModal;
