import React, { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import Modal from './Modal';

// Commonly used icons for cost categories
const COST_CATEGORY_ICONS = [
  'DollarSign',
  'CreditCard',
  'Wallet',
  'Receipt',
  'ShoppingCart',
  'Home',
  'Zap',
  'Wrench',
  'Users',
  'Truck',
  'Package',
  'Coffee',
  'Utensils',
  'Wifi',
  'Phone',
  'Mail',
  'FileText',
  'Briefcase',
  'Building',
  'Car',
  'Fuel',
  'Lightbulb',
  'Tool',
  'Hammer',
  'PaintBucket',
  'Scissors',
  'ShoppingBag',
  'Gift',
  'Heart',
  'Star',
  'Award',
  'Target',
  'TrendingUp',
  'BarChart',
  'PieChart',
  'Activity',
  'Clipboard',
  'Calendar',
  'Clock',
  'MapPin',
  'Globe',
  'Printer',
  'Monitor',
  'Smartphone',
  'Tablet',
  'Laptop',
  'HardDrive',
  'Database',
  'Server',
  'Cloud',
  'Umbrella',
  'Droplet',
  'Wind',
  'Sun',
  'Moon',
  'Thermometer',
  'Battery',
  'Plug',
  'Settings',
  'Sliders',
  'Filter',
  'Search',
  'Bell',
  'AlertCircle',
  'CheckCircle',
  'XCircle',
  'Info',
  'HelpCircle',
  'Plus',
  'Minus',
  'Edit',
  'Trash2',
  'Save',
  'Download',
  'Upload',
  'Share',
  'Link',
  'Lock',
  'Unlock',
  'Key',
  'Shield',
  'Eye',
  'EyeOff',
  'Image',
  'Video',
  'Music',
  'Headphones',
  'Mic',
  'Camera',
  'Film',
  'Book',
  'BookOpen',
  'Bookmark',
  'Tag',
  'Flag',
  'Inbox',
  'Send',
  'Archive',
  'Folder',
  'FolderOpen',
  'Copy',
];

interface IconPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (iconName: string) => void;
  selectedIcon?: string;
}

const IconPickerModal: React.FC<IconPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  selectedIcon,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter icons based on search term
  const filteredIcons = useMemo(() => {
    if (!searchTerm.trim()) {
      return COST_CATEGORY_ICONS;
    }
    
    const search = searchTerm.toLowerCase();
    return COST_CATEGORY_ICONS.filter(iconName =>
      iconName.toLowerCase().includes(search)
    );
  }, [searchTerm]);

  const handleIconSelect = (iconName: string) => {
    onSelect(iconName);
    onClose();
  };

  const renderIcon = (iconName: string) => {
    const IconComponent = (LucideIcons as any)[iconName];
    if (!IconComponent) return null;
    return <IconComponent className="w-6 h-6" />;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="اختر أيقونة"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="search-icon absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="ابحث عن أيقونة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Icon Grid */}
        <div className="max-h-96 overflow-y-auto">
          {filteredIcons.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              لم يتم العثور على أيقونات مطابقة
            </div>
          ) : (
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
              {filteredIcons.map((iconName) => (
                <button
                  key={iconName}
                  onClick={() => handleIconSelect(iconName)}
                  className={`
                    icon-grid-item icon-search-result
                    flex flex-col items-center justify-center p-3 rounded-lg
                    ${
                      selectedIcon === iconName
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500'
                        : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }
                  `}
                  title={iconName}
                >
                  {renderIcon(iconName)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
          {filteredIcons.length} أيقونة متاحة
        </div>
      </div>
    </Modal>
  );
};

export default IconPickerModal;
