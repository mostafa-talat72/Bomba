import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface TablesHeaderActions {
  openManagement: () => void;
  refresh: () => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
}

interface TablesHeaderContextType {
  actions: TablesHeaderActions | null;
  registerActions: (a: TablesHeaderActions) => void;
  unregisterActions: () => void;
}

const TablesHeaderContext = createContext<TablesHeaderContextType | undefined>(undefined);

export const useTablesHeader = () => {
  const context = useContext(TablesHeaderContext);
  if (context === undefined) {
    throw new Error('useTablesHeader must be used within a TablesHeaderProvider');
  }
  return context;
};

interface TablesHeaderProviderProps {
  children: ReactNode;
}

export const TablesHeaderProvider: React.FC<TablesHeaderProviderProps> = ({ children }) => {
  const [actions, setActions] = useState<TablesHeaderActions | null>(null);

  const registerActions = useCallback((a: TablesHeaderActions) => {
    setActions(a);
  }, []);

  const unregisterActions = useCallback(() => {
    setActions(null);
  }, []);

  return (
    <TablesHeaderContext.Provider value={{ actions, registerActions, unregisterActions }}>
      {children}
    </TablesHeaderContext.Provider>
  );
};
