import React from 'react';
import { X, CheckCircle, Folder } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MenuCategory, MenuSection } from '../../services/api';

interface MenuCategoryModalProps {
	isOpen: boolean;
 onClose: () => void;
 onSave: (data: { name: string; description: string; section: string; sortOrder: number }) => Promise<void>;
	editingCategory: MenuCategory | null;
	formData: {
		name: string;
		description: string;
		section: string;
		sortOrder: number;
	};
	setFormData: React.Dispatch<React.SetStateAction<{ name: string; description: string; section: string; sortOrder: number }>>;
	menuSections: MenuSection[];
	saving: boolean;
}

const MenuCategoryModal: React.FC<MenuCategoryModalProps> = ({
	isOpen,
	onClose,
	onSave,
	editingCategory,
	formData,
	setFormData,
	menuSections,
	saving
}) => {
	const { t } = useTranslation();

	if (!isOpen) return null;

	return (
		<div
			className="modal-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700">
				{/* Header */}
				<div className="bg-gradient-to-r from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 px-6 py-5 rounded-t-2xl">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-white/20 rounded-lg">
								<Folder className="h-6 w-6 text-white" />
							</div>
							<h3 className="text-xl font-bold text-white">
								{editingCategory ? t('menu.editCategoryTitle') : t('menu.addNewCategory')}
							</h3>
						</div>
						<button
							onClick={onClose}
							className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
						>
							<X className="h-6 w-6" />
						</button>
					</div>
				</div>

				{/* Content */}
				<div className="p-6 space-y-5">
					<div>
						<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
							{t('menu.categoryName')} <span className="text-red-500">*</span>
						</label>
						<input
							type="text"
							value={formData.name}
							onChange={(e) => setFormData({ ...formData, name: e.target.value })}
							className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
							placeholder={t('menu.categoryNamePlaceholder')}
							autoFocus
						/>
					</div>

					<div>
						<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
							{t('menu.selectSection')} <span className="text-red-500">*</span>
						</label>
						<select
							value={formData.section}
							onChange={(e) => setFormData({ ...formData, section: e.target.value })}
							className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
						>
							<option value="">{t('menu.selectSection')}</option>
							{menuSections.map(section => (
								<option key={section.id} value={section.id}>{section.name}</option>
							))}
						</select>
					</div>

					<div>
						<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('menu.description')}</label>
						<textarea
							value={formData.description}
							onChange={(e) => setFormData({ ...formData, description: e.target.value })}
							className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
							rows={3}
							placeholder={t('menu.descriptionPlaceholder')}
						/>
					</div>

					<div>
						<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('menu.sortOrder')}</label>
						<input
							type="number"
							value={formData.sortOrder}
							onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
							className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
							min="0"
						/>
					</div>
				</div>

				{/* Footer */}
				<div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
					<button
						onClick={onClose}
						className="px-6 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-all duration-200 font-medium"
					>
						{t('common.cancel')}
					</button>
					<button
						onClick={() => onSave(formData)}
						disabled={saving}
						className="px-8 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-md hover:shadow-lg"
					>
						{saving ? (
							<>
								<div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
								<span>{t('menu.saving')}</span>
							</>
						) : (
							<>
								<CheckCircle className="h-5 w-5" />
								<span>{editingCategory ? t('common.saveChanges') : t('common.save')}</span>
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
};

export default MenuCategoryModal;
