import React from 'react';
import { X, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface MenuDeleteModalProps {
	isOpen: boolean;
 onClose: () => void;
 onConfirm: () => void;
	type: 'item' | 'section' | 'category';
	isDeleting: boolean;
}

const MenuDeleteModal: React.FC<MenuDeleteModalProps> = ({
	isOpen,
	onClose,
	onConfirm,
	type,
	isDeleting
}) => {
	const { t } = useTranslation();

	if (!isOpen) return null;

	const typeLabels = {
		item: t('menu.item'),
		section: t('menu.deleteSection'),
		category: t('menu.deleteCategory')
	};

	return (
		<div className="modal-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
			<div className="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700">
				<div className="p-6">
					<div className="flex items-center justify-between mb-6">
						<div className="flex items-center gap-3">
							<div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
								<Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
							</div>
							<h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('menu.confirmDelete')}</h3>
						</div>
						<button
							onClick={onClose}
							disabled={isDeleting}
							className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 disabled:opacity-50"
						>
							<X className="h-6 w-6" />
						</button>
					</div>

					<div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
						<p className="text-gray-700 dark:text-gray-300 text-center font-medium">
							{t('menu.confirmDelete')} {typeLabels[type]}?
						</p>
						<p className="text-sm text-red-600 dark:text-red-400 text-center mt-2">
							⚠️ {t('menu.cannotUndo')}
						</p>
					</div>

					<div className="flex justify-end gap-3">
						<button
							onClick={onClose}
							disabled={isDeleting}
							className="action-button px-6 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-all duration-200 disabled:opacity-50 font-medium"
						>
							{t('common.cancel')}
						</button>
						<button
							onClick={onConfirm}
							disabled={isDeleting}
							className="action-button px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl transition-all duration-200 disabled:opacity-50 flex items-center gap-2 font-medium shadow-md hover:shadow-lg"
						>
							{isDeleting ? (
								<>
									<div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
									<span>{t('menu.deleting')}</span>
								</>
							) : (
								<>
									<Trash2 className="h-5 w-5" />
									<span>{t('common.delete')}</span>
								</>
							)}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default MenuDeleteModal;
