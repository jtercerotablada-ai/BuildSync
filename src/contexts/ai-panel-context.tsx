'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface AIPanelContextType {
  isOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
}

const AIPanelContext = createContext<AIPanelContextType | undefined>(undefined);

export function AIPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openPanel = () => setIsOpen(true);
  const closePanel = () => setIsOpen(false);
  const togglePanel = () => setIsOpen(prev => !prev);

  return (
    <AIPanelContext.Provider value={{ isOpen, openPanel, closePanel, togglePanel }}>
      {children}
    </AIPanelContext.Provider>
  );
}

export function useAIPanel() {
  const context = useContext(AIPanelContext);
  if (context === undefined) {
    throw new Error('useAIPanel must be used within an AIPanelProvider');
  }
  return context;
}
