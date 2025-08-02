export type Permission =
    | "all"
    | "settings"
    | "dashboard"
    | "playstation"
    | "computer"
    | "cafe"
    | "menu"
    | "billing"
    | "reports"
    | "inventory"
    | "users"
    | "costs";

export interface GeneralSettings {
    systemName: string;
    language: string;
    timezone: string;
    currency: string;
}

export interface BusinessSettings {
    businessName: string;
    businessType: string;
    taxRate: number;
    serviceCharge: number;
}

export interface NotificationsSettings {
    emailNotifications: boolean;
    smsNotifications: boolean;
    pushNotifications: boolean;
}

export interface SettingsData {
    general: GeneralSettings;
    business: BusinessSettings;
    notifications: NotificationsSettings;
}

export interface TabState {
    loading: boolean;
    saving: boolean;
    error: string;
    success: string;
}

export interface TabProps {
    settings: GeneralSettings | BusinessSettings | NotificationsSettings;
    onSave: (settings: GeneralSettings | BusinessSettings | NotificationsSettings) => void;
    canEdit: boolean;
    loading: boolean;
    saving: boolean;
    error: string;
    success: string;
}
