import React from 'react';
import { Edit, Trash2, Plus, FolderOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MenuCategory } from '../../services/api';
import { formatDecimal } from '../../utils/formatters';
import MenuItemCard from './MenuItemCard';
import { MenuItem } from '../../services/api';

interface MenuCategoryCardProps {
	category: MenuCategory;
	items: MenuItem[];
	isExpanded: boolean;
	onToggle: () => void;
	onEdit: (category: MenuCategory) => void;
	onDelete: (categoryId: string) => void;
	onAddItem: (categoryId: string) => void;
	onEditItem: (item: MenuItem) => void;
	onDeleteItem: (itemId: string) => void;
	onDuplicateItem: (item: MenuItem) => void;
	onQuickViewItem: (item: MenuItem) => void;
	deletingCategories: Record<string, boolean>;
	deletingItems: Record<string, boolean>;
	searchTerm?: string;
	inventoryItems?: Array<{ id: string; name: string }>;
}

const MenuCategoryCard: React.FC<MenuCategoryCardProps> = ({
	category,
	items,
	isExpanded,
	onToggle,
	onEdit,
	onDelete,
	onAddItem,
	onEditItem,
	onDeleteItem,
	onDuplicateItem,
	onQuickViewItem,
	deletingCategories,
	deletingItems,
	searchTerm = '',
	inventoryItems = []
}) => {
	const { t, i18n } = useTranslation();

	const filteredItems = searchTerm
		? items.filter(item =>
			item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			(item.description?.toLowerCase()?.includes(searchTerm.toLowerCase()) ?? false)
		)
		: items;

	return (
		<div className="border-2 border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
			{/* Category Header */}
			<div
				className="category-header p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors duration-200"
				onClick={onToggle}
			>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3 flex-1 min-w-0">
						<button className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-all duration-200">
							{isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
						</button>
						<div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-sm shrink-0">
							<FolderOpen className="h-4 w-4 text-white" />
						</div>
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2">
								<h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{category.name}</h3>
								<span className="badge px-2.5 py-1 text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full shrink-0">
									{formatDecimal(filteredItems.length, i18n.language)} {t('menu.itemsCountLabel')}
								</span>
							</div>
							{category.description && (
								<p className="text-xs text-gray-500 dark:text-gray-400 truncate">{category.description}</p>
							)}
						</div>
					</div>
					<div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
						<button
							onClick={() => onAddItem(category.id)}
							className="action-button p-2 text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20 rounded-lg transition-all duration-200"
							title={t('menu.addItem')}
						>
							<Plus className="h-4 w-4" />
						</button>
						<button
							onClick={() => onEdit(category)}
							className="action-button p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
							title={t('menu.editCategory')}
						>
							<Edit className="h-4 w-4" />
						</button>
						<button
							onClick={() => onDelete(category.id)}
							disabled={deletingCategories[category.id]}
							className={`action-button p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 ${deletingCategories[category.id] ? 'opacity-50 cursor-not-allowed' : ''}`}
							title={t('menu.deleteCategory')}
						>
							{deletingCategories[category.id] ? (
								<div className="animate-spin rounded-full h-4 w-4 border-2 border-red-200 border-t-red-600"></div>
							) : (
								<Trash2 className="h-4 w-4" />
							)}
						</button>
					</div>
				</div>
			</div>

			{/* Items Grid */}
			{isExpanded && (
				<div className="p-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900/30 dark:to-gray-800/30">
					{filteredItems.length === 0 ? (
						<div className="empty-state text-center py-8 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
							<p className="text-gray-500 dark:text-gray-400 text-sm">
								{searchTerm ? t('menu.noSearchResults') : t('menu.noItemsInCategory')}
							</p>
						</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{filteredItems.map((item) => (
								<MenuItemCard
									key={item.id}
									item={item}
									onEdit={onEditItem}
									onDelete={onDeleteItem}
									onDuplicate={onDuplicateItem}
									onQuickView={onQuickViewItem}
									isDeleting={deletingItems[item.id]}
									inventoryItems={inventoryItems}
								/>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
};

export default MenuCategoryCard;
