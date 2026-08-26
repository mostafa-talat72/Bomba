import React from 'react';

export interface DataActions {
  clearAllData: () => void;
  setSessions: React.Dispatch<React.SetStateAction<any[]>>;
  setOrders: React.Dispatch<React.SetStateAction<any[]>>;
  setInventory: React.Dispatch<React.SetStateAction<any[]>>;
  setBills: React.Dispatch<React.SetStateAction<any[]>>;
  setCosts: React.Dispatch<React.SetStateAction<any[]>>;
  setDevices: React.Dispatch<React.SetStateAction<any[]>>;
  setMenuItems: React.Dispatch<React.SetStateAction<any[]>>;
  setInventoryItems: React.Dispatch<React.SetStateAction<any[]>>;
  setUsers: React.Dispatch<React.SetStateAction<any[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<any[]>>;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setNotification: React.Dispatch<React.SetStateAction<any>>;
}

let dataActionsRef: DataActions | null = null;

export const setDataActionsRef = (actions: DataActions) => {
  dataActionsRef = actions;
};

export const getDataActionsRef = (): DataActions | null => dataActionsRef;
