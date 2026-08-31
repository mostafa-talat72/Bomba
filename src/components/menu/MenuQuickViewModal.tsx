import React from 'react';
import { X, Clock, TrendingUp, Star, Edit, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MenuItem } from '../../services/api';
import { formatCurrency, formatQuantity, formatDecimal } from '../../utils/formatters';

interface MenuQuickViewModalProps {
	isOpen: boolean;
 onClose: () => void;
	item: MenuItem | null;
	onEdit: (item: MenuItem) => void;
	onDuplicate: (item: MenuItem) => void;
	inventoryItems?: Array<{ id: string; name: string }>;
}

const MenuQuickViewModal: React.FC<MenuQuickViewModalProps> = ({
	isOpen,
	onClose,
	item,
	onEdit,
	onDuplicate,
	inventoryItems = []
}) => {
	const { t, i18n } = useTranslation();

	if (!isOpen || !item) return null;

	const getIngredientName = (itemId: string) => {
		const invItem = inventoryItems.find(i => i.id === itemId);
		return invItem?.name || '';
	};

	return (
		<div
			className="modal-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
				{/* Header */}
				<div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-5">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-white/20 rounded-lg">
								<span className="text-xl">👁️</span>
							</div>
							<h3 className="text-xl font-bold text-white">{item.name}</h3>
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
					{/* Status + Price with variants */}
					<div className="flex items-center justify-between">
						<span className={`px-3 py-1.5 text-sm font-bold rounded-full ${
							item.isAvailable
								? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
								: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
						}`}>
							{item.isAvailable ? t('menu.available') : t('menu.unavailable')}
						</span>
						{item.variants && item.variants.length > 0 ? (
							<div className="flex flex-col items-end gap-1">
								{item.variants.map(v => (
									<span key={v.size} className="text-sm font-bold bg-gradient-to-r from-green-600 to-green-500 bg-clip-text text-transparent">
										{v.size}: {formatCurrency(v.price, i18n.language)}
									</span>
								))}
							</div>
						) : (
							<span className="text-2xl font-bold bg-gradient-to-r from-green-600 to-green-500 bg-clip-text text-transparent">
								{formatCurrency(item.price, i18n.language)}
							</span>
						)}
					</div>

					{/* Description */}
					{item.description && (
						<div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
							<p className="text-sm text-gray-700 dark:text-gray-300">{item.description}</p>
						</div>
					)}

					{/* Stats */}
					<div className="grid grid-cols-3 gap-3">
						<div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
							<div className="flex items-center justify-center gap-1 text-blue-600 dark:text-blue-400 mb-1">
								<Clock className="h-4 w-4" />
							</div>
							<div className="text-lg font-bold text-blue-700 dark:text-blue-300">
								{formatDecimal(item.preparationTime, i18n.language)}
							</div>
							<div className="text-xs text-blue-600 dark:text-blue-400">{t('menu.minutes')}</div>
						</div>
						<div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
							<div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400 mb-1">
								<TrendingUp className="h-4 w-4" />
							</div>
							<div className="text-lg font-bold text-green-700 dark:text-green-300">
								{formatDecimal(item.orderCount, i18n.language)}
							</div>
							<div className="text-xs text-green-600 dark:text-green-400">طلب</div>
						</div>
						<div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-3 text-center">
							<div className="flex items-center justify-center gap-1 text-yellow-600 dark:text-yellow-400 mb-1">
								{item.isPopular ? <Star className="h-4 w-4 fill-yellow-500" /> : <Star className="h-4 w-4" />}
							</div>
							<div className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
								{item.isPopular ? 'مميز' : 'عادي'}
							</div>
							<div className="text-xs text-yellow-600 dark:text-yellow-400">التصنيف</div>
						</div>
					</div>

					{/* Ingredients */}
					{item.ingredients && item.ingredients.length > 0 && (
						<div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
							<h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">🧪 {t('menu.ingredientsLabel')}</h4>
							<div className="flex flex-wrap gap-2">
								{item.ingredients.map((ing, idx) => (
									<span key={idx} className="px-2 py-1 bg-white dark:bg-gray-700 rounded-full text-xs text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-600">
										{getIngredientName(ing.item)} ({formatQuantity(ing.quantity, ing.unit)})
									</span>
								))}
							</div>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
					<button
						onClick={() => {
							onDuplicate(item);
							onClose();
						}}
						className="px-4 py-2 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20 rounded-lg transition-all duration-200 flex items-center gap-2 text-sm font-medium"
					>
						<Copy className="h-4 w-4" />
						نسخ
					</button>
					<button
						onClick={() => {
							onEdit(item);
							onClose();
						}}
						className="px-4 py-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200 flex items-center gap-2 text-sm font-medium"
					>
						<Edit className="h-4 w-4" />
						{t('menu.edit')}
					</button>
				</div>
			</div>
		</div>
	);
};

export default MenuQuickViewModal;
