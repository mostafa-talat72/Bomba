import React from 'react';
import { Edit, Trash2, Star, Clock, TrendingUp, Eye, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MenuItem } from '../../services/api';
import { formatCurrency, formatQuantity, formatDecimal } from '../../utils/formatters';

interface MenuItemCardProps {
	item: MenuItem;
	onEdit: (item: MenuItem) => void;
	onDelete: (itemId: string) => void;
	onDuplicate: (item: MenuItem) => void;
	onQuickView: (item: MenuItem) => void;
	isDeleting?: boolean;
	inventoryItems?: Array<{ id: string; name: string }>;
	isDragging?: boolean;
}

const MenuItemCard: React.FC<MenuItemCardProps> = ({
	item,
	onEdit,
	onDelete,
	onDuplicate,
	onQuickView,
	isDeleting = false,
	inventoryItems = [],
	isDragging = false
}) => {
	const { t, i18n } = useTranslation();

	const getStatusColor = (isAvailable: boolean) => {
		return isAvailable
			? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
			: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
	};

	const getIngredientName = (itemId: string) => {
		const invItem = inventoryItems.find(i => i.id === itemId);
		return invItem?.name || '';
	};

	return (
		<div
			className={`item-card group bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-5 transition-all duration-300 hover:border-orange-300 dark:hover:border-orange-600 hover:shadow-lg ${
				isDragging ? 'opacity-50 scale-95' : ''
			}`}
		>
			{/* Header: Name + Status */}
			<div className="flex items-start justify-between mb-3">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1 flex-wrap">
						<h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{item.name}</h3>
						{item.isNew && (
							<span className="badge px-2 py-0.5 text-xs font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full">
								{t('menu.new')}
							</span>
						)}
						{item.isPopular && (
							<Star className="popular-star h-4 w-4 text-yellow-500 fill-yellow-500" />
						)}
					</div>
					{item.description && (
						<p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{item.description}</p>
					)}
				</div>
				<span className={`badge px-2.5 py-1 text-xs font-bold rounded-full shrink-0 ${getStatusColor(item.isAvailable)}`}>
					{item.isAvailable ? t('menu.available') : t('menu.unavailable')}
				</span>
			</div>

			{/* Ingredients Preview */}
			{item.ingredients && item.ingredients.length > 0 && (
				<div className="text-xs text-blue-600 dark:text-blue-400 mb-3 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg">
					<span className="font-semibold">{t('menu.ingredientsLabel')}:</span>{' '}
					{item.ingredients.slice(0, 3).map((ing) => {
						const name = getIngredientName(ing.item);
						return name ? `${name} (${formatQuantity(ing.quantity, ing.unit)})` : `${formatQuantity(ing.quantity, ing.unit)}`;
					}).join(', ')}
					{item.ingredients.length > 3 && ` +${item.ingredients.length - 3}`}
				</div>
			)}

			{/* Price + Stats with variants */}
			<div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">
				<div className="flex flex-col gap-1">
					{item.variants && item.variants.length > 0 ? (
						<div className="flex flex-wrap gap-1">
							{item.variants.slice(0, 3).map(v => (
								<span key={v.size} className="price-tag text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full font-bold">
									{v.size}: {formatCurrency(v.price, i18n.language)}
								</span>
							))}
							{item.variants.length > 3 && <span className="text-xs text-gray-400">+{item.variants.length - 3}</span>}
						</div>
					) : (
						<span className="price-tag text-xl font-bold bg-gradient-to-r from-green-600 to-green-500 bg-clip-text text-transparent">
							{formatCurrency(item.price, i18n.language)}
						</span>
					)}
					{item.variants && item.variants.length > 1 && (
						<span className="text-xs text-gray-400">{item.variants.length} أحجام</span>
					)}
				</div>
				<div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
					<div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
						<TrendingUp className="h-3.5 w-3.5" />
						<span className="font-semibold">{formatDecimal(item.orderCount, i18n.language)}</span>
					</div>
					<div className="flex items-center gap-1">
						<Clock className="h-3.5 w-3.5 text-orange-500" />
						<span>{formatDecimal(item.preparationTime, i18n.language)} {t('menu.minutes')}</span>
					</div>
				</div>
			</div>

			{/* Action Buttons */}
			<div className="flex items-center justify-between gap-2">
				<button
					onClick={() => onQuickView(item)}
					className="action-button p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition-all duration-200"
					title={t('menu.view') || 'عرض'}
				>
					<Eye className="h-4 w-4" />
				</button>
				<div className="flex items-center gap-1">
					<button
						onClick={() => onDuplicate(item)}
						className="action-button p-2 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20 rounded-lg transition-all duration-200"
						title={t('menu.duplicate') || 'نسخ'}
					>
						<Copy className="h-4 w-4" />
					</button>
					<button
						onClick={() => onEdit(item)}
						className="action-button p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
						title={t('menu.edit')}
					>
						<Edit className="h-4 w-4" />
					</button>
					<button
						onClick={() => onDelete(item.id)}
						disabled={isDeleting}
						className={`action-button p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 ${isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}
						title={t('menu.delete')}
					>
						{isDeleting ? (
							<div className="animate-spin rounded-full h-4 w-4 border-2 border-red-200 border-t-red-600"></div>
						) : (
							<Trash2 className="h-4 w-4" />
						)}
					</button>
				</div>
			</div>
		</div>
	);
};

export default MenuItemCard;
