import React from 'react';
import { Edit, Trash2, Plus, Layers, ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MenuSection, MenuCategory, MenuItem } from '../../services/api';
import MenuCategoryCard from './MenuCategoryCard';

interface MenuSectionCardProps {
	section: MenuSection;
	categories: MenuCategory[];
	items: MenuItem[];
	isExpanded: boolean;
	onToggle: () => void;
	onEdit: (section: MenuSection) => void;
	onDelete: (sectionId: string) => void;
	onAddCategory: (sectionId: string) => void;
	onEditCategory: (category: MenuCategory) => void;
	onDeleteCategory: (categoryId: string) => void;
	onAddItem: (categoryId: string) => void;
	onEditItem: (item: MenuItem) => void;
	onDeleteItem: (itemId: string) => void;
	onDuplicateItem: (item: MenuItem) => void;
	onQuickViewItem: (item: MenuItem) => void;
	expandedCategories: Record<string, boolean>;
	toggleCategory: (categoryId: string) => void;
	deletingSections: Record<string, boolean>;
	deletingCategories: Record<string, boolean>;
	deletingItems: Record<string, boolean>;
	searchTerm?: string;
	inventoryItems?: Array<{ id: string; name: string }>;
}

const MenuSectionCard: React.FC<MenuSectionCardProps> = ({
	section,
	categories,
	items,
	isExpanded,
	onToggle,
	onEdit,
	onDelete,
	onAddCategory,
	onEditCategory,
	onDeleteCategory,
	onAddItem,
	onEditItem,
	onDeleteItem,
	onDuplicateItem,
	onQuickViewItem,
	expandedCategories,
	toggleCategory,
	deletingSections,
	deletingCategories,
	deletingItems,
	searchTerm = '',
	inventoryItems = []
}) => {
	const { t } = useTranslation();

	const totalItems = categories.reduce((acc, cat) => {
		return acc + items.filter(item => {
			const categoryId = typeof item.category === 'string' ? item.category : item.category?._id || item.category?.id;
			const categoryIdValue = cat._id || cat.id;
			return String(categoryId) === String(categoryIdValue);
		}).length;
	}, 0);

	return (
		<div className="menu-card bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
			{/* Section Header */}
			<div
				className="section-header p-5 border-b-2 border-blue-200 dark:border-blue-700 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors duration-200"
				onClick={onToggle}
			>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4 flex-1 min-w-0">
						<button className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-all duration-200">
							{isExpanded ? <ChevronDown className="h-6 w-6" /> : <ChevronRight className="h-6 w-6" />}
						</button>
						<div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md shrink-0">
							<Layers className="h-5 w-5 text-white" />
						</div>
						<div className="flex-1 min-w-0">
							<h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">{section.name}</h2>
							{section.description && (
								<p className="text-sm text-gray-600 dark:text-gray-400 truncate">{section.description}</p>
							)}
							<div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
								<span>{categories.length} {t('menu.categories') || 'تصنيف'}</span>
								<span>•</span>
								<span>{totalItems} {t('menu.totalItems') || 'عنصر'}</span>
							</div>
						</div>
					</div>
					<div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
						<button
							onClick={() => onAddCategory(section.id)}
							className="action-button p-2.5 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
							title={t('menu.addCategory')}
						>
							<Plus className="h-5 w-5" />
						</button>
						<button
							onClick={() => onEdit(section)}
							className="action-button p-2.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
							title={t('menu.editSection')}
						>
							<Edit className="h-5 w-5" />
						</button>
						<button
							onClick={() => onDelete(section.id)}
							disabled={deletingSections[section.id]}
							className={`action-button p-2.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md ${deletingSections[section.id] ? 'opacity-50 cursor-not-allowed' : ''}`}
							title={t('menu.deleteSection')}
						>
							{deletingSections[section.id] ? (
								<div className="animate-spin rounded-full h-5 w-5 border-2 border-red-200 border-t-red-600"></div>
							) : (
								<Trash2 className="h-5 w-5" />
							)}
						</button>
					</div>
				</div>
			</div>

			{/* Categories */}
			{isExpanded && (
				<div className="p-5 space-y-4 bg-gray-50/50 dark:bg-gray-900/20">
					{categories.length === 0 ? (
						<div className="empty-state text-center py-8 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
							<p className="text-gray-500 dark:text-gray-400 text-sm">{t('menu.noCategoriesInSection')}</p>
						</div>
					) : (
						categories.map((category) => {
							const categoryItems = items.filter(item => {
								const catId = typeof item.category === 'string' ? item.category : item.category?.id || item.category?._id;
								return catId === category.id;
							}).sort((a, b) => a.name.localeCompare(b.name));

							return (
								<MenuCategoryCard
									key={category.id}
									category={category}
									items={categoryItems}
									isExpanded={expandedCategories[category.id] ?? false}
									onToggle={() => toggleCategory(category.id)}
									onEdit={onEditCategory}
									onDelete={onDeleteCategory}
									onAddItem={onAddItem}
									onEditItem={onEditItem}
									onDeleteItem={onDeleteItem}
									onDuplicateItem={onDuplicateItem}
									onQuickViewItem={onQuickViewItem}
									deletingCategories={deletingCategories}
									deletingItems={deletingItems}
									searchTerm={searchTerm}
									inventoryItems={inventoryItems}
								/>
							);
						})
					)}
				</div>
			)}
		</div>
	);
};

export default MenuSectionCard;
