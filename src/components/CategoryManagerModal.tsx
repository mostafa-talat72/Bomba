import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Save, DollarSign, AlertCircle } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import IconPickerModal from './IconPickerModal';
import ConfirmDialog from './ConfirmDialog';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

interface CostCategory {
  _id: string;
  name: string;
  icon: string;
  color: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
}

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const { showNotification } = useApp();
  const [categories, setCategories] = useState<CostCategory[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CostCategory | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [fetchLoading, setFetchLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    icon: 'DollarSign',
    color: '#3B82F6',
    description: '',
    sortOrder: 0,
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; categoryId: string | null }>({
    show: false,
    categoryId: null,
  });

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  useEffect(() => {
    if (editingCategory) {
      setFormData({
        name: editingCategory.name,
        icon: editingCategory.icon,
        color: editingCategory.color,
        description: editingCategory.description || '',
        sortOrder: editingCategory.sortOrder,
      });
      setShowForm(true);
    }
  }, [editingCategory]);

  const fetchCategories = async () => {
    try {
      setFetchLoading(true);
      const response = await api.get('/cost-categories');
      const categoriesData = Array.isArray(response) ? response : (response.data || []);
      setCategories(categoriesData);
    } catch (error: any) {
      setCategories([]);
      showNotification(
        error.response?.data?.message || 'فشل في تحميل الأقسام',
        'error'
      );
    } finally {
      setFetchLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      icon: 'DollarSign',
      color: '#3B82F6',
      description: '',
      sortOrder: 0,
    });
    setEditingCategory(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showNotification('يرجى إدخال اسم القسم', 'error');
      return;
    }

    try {
      setLoading(true);

      if (editingCategory) {
        await api.put(`/cost-categories/${editingCategory._id}`, formData);
        showNotification('تم تحديث القسم بنجاح', 'success');
      } else {
        await api.post('/cost-categories', formData);
        showNotification('تم إنشاء القسم بنجاح', 'success');
      }

      resetForm();
      await fetchCategories();
      setTimeout(() => onSave(), 100);
    } catch (error: any) {
      const message = error.response?.data?.message || 'فشل في حفظ القسم';
      showNotification(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (categoryId: string) => {
    setDeleteConfirm({ show: true, categoryId });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.categoryId) return;

    try {
      setDeleting(deleteConfirm.categoryId);
      await api.delete(`/cost-categories/${deleteConfirm.categoryId}`);
      showNotification('تم حذف القسم بنجاح', 'success');
      await fetchCategories();
      onSave();
    } catch (error: any) {
      const message = error.response?.data?.message || 'فشل في حذف القسم';
      showNotification(message, 'error');
    } finally {
      setDeleting(null);
      setDeleteConfirm({ show: false, categoryId: null });
    }
  };

  const handleEdit = (category: CostCategory) => {
    setEditingCategory(category);
  };

  const handleAddNew = () => {
    resetForm();
    setShowForm(true);
  };

  const getCategoryIcon = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName] || LucideIcons.DollarSign;
    return <Icon className="w-5 h-5" />;
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
        <div 
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-slideUp"
          dir="rtl"
        >
          {/* Header */}
          <div 
            className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
            style={{ 
              background: 'linear-gradient(135deg, #667eea15 0%, #764ba205 100%)'
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div
                  className="p-4 rounded-2xl"
                  style={{ 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    boxShadow: '0 8px 24px -6px rgba(102, 126, 234, 0.6)'
                  }}
                >
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    إدارة أقسام التكاليف
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    إضافة وتعديل وحذف أقسام التكاليف
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1 modern-scrollbar">
            <div className="space-y-4">
              {/* Add New Button */}
              {!showForm && (
                <button
                  onClick={handleAddNew}
                  className="w-full group relative overflow-hidden flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-semibold"
                >
                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                  <div className="relative flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    <span>إضافة قسم جديد</span>
                  </div>
                </button>
              )}

              {/* Category Form */}
              {showForm && (
                <form onSubmit={handleSubmit} className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl p-6 space-y-5 border-2 border-gray-200 dark:border-gray-600 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                        {editingCategory ? <Edit2 className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {editingCategory ? 'تعديل القسم' : 'قسم جديد'}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-xl transition-all duration-200 hover:scale-110"
                    >
                      <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>

                  {/* Name Input */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      اسم القسم <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="مثال: رواتب، إيجار، صيانة"
                      className="form-field w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold"
                      required
                    />
                  </div>

                  {/* Icon and Color Picker */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                        الأيقونة
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowIconPicker(true)}
                        className="w-full flex items-center justify-between px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 hover:scale-105"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="p-2 rounded-lg"
                            style={{ backgroundColor: `${formData.color}20` }}
                          >
                            <div style={{ color: formData.color }}>
                              {getCategoryIcon(formData.icon)}
                            </div>
                          </div>
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {formData.icon}
                          </span>
                        </div>
                        <Edit2 className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                        اللون
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={formData.color}
                          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                          className="h-12 w-20 rounded-xl border-2 border-gray-300 dark:border-gray-600 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formData.color}
                          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                          placeholder="#3B82F6"
                          className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-semibold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      الوصف <span className="text-xs font-normal text-gray-500">(اختياري)</span>
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="وصف مختصر للقسم..."
                      rows={3}
                      className="form-field w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                    />
                  </div>

                  {/* Sort Order */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      ترتيب العرض
                    </label>
                    <input
                      type="number"
                      value={formData.sortOrder}
                      onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                      className="form-field w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      الأقسام ذات الترتيب الأقل تظهر أولاً
                    </p>
                  </div>

                  {/* Form Actions */}
                  <div className="flex gap-3 pt-4 border-t-2 border-gray-200 dark:border-gray-700">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 group relative overflow-hidden flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 font-semibold"
                    >
                      <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                      <div className="relative flex items-center gap-2">
                        {loading ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>جاري الحفظ...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-5 h-5" />
                            <span>حفظ القسم</span>
                          </>
                        )}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-xl transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 font-semibold"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              )}

              {/* Categories List */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    الأقسام الحالية
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold">
                    {categories?.length || 0}
                  </span>
                </div>
                
                {fetchLoading ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500 dark:text-gray-400 font-semibold">جاري التحميل...</p>
                  </div>
                ) : !categories || categories.length === 0 ? (
                  <div className="text-center py-12 px-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border-2 border-dashed border-gray-300 dark:border-gray-600">
                    <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 font-semibold">لا توجد أقسام</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">قم بإضافة قسم جديد للبدء</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto modern-scrollbar">
                    {categories?.map((category) => (
                      <div
                        key={category._id}
                        className="flex items-center justify-between p-4 bg-gradient-to-br from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:shadow-lg transition-all duration-200 hover:scale-105"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div
                            className="p-3 rounded-lg"
                            style={{ backgroundColor: `${category.color}20` }}
                          >
                            <div style={{ color: category.color }}>
                              {getCategoryIcon(category.icon)}
                            </div>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 dark:text-white">
                              {category.name}
                            </h4>
                            {category.description && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {category.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                الترتيب: {category.sortOrder}
                              </span>
                              <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                {category.color}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(category)}
                            className="p-2.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-all duration-200 hover:scale-110"
                            title="تعديل"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(category._id)}
                            disabled={deleting === category._id}
                            className="p-2.5 text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all duration-200 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            title="حذف"
                          >
                            {deleting === category._id ? (
                              <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <Trash2 className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Icon Picker Modal */}
      {showIconPicker && (
        <IconPickerModal
          isOpen={showIconPicker}
          onClose={() => setShowIconPicker(false)}
          onSelect={(iconName) => {
            setFormData({ ...formData, icon: iconName });
            setShowIconPicker(false);
          }}
          selectedIcon={formData.icon}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, categoryId: null })}
        onConfirm={handleDeleteConfirm}
        title="تأكيد الحذف"
        message="هل أنت متأكد من حذف هذا القسم؟ قد يؤثر ذلك على التكاليف المرتبطة به."
        confirmText="حذف"
        cancelText="إلغاء"
        type="danger"
        loading={deleting !== null}
      />
    </>
  );
};

export default CategoryManagerModal;
