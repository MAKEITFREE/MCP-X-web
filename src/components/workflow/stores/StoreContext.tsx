import { createContext, useContext, type ReactNode } from 'react';
import { useSystemStore } from './systemStore';

type StoreHook = typeof useSystemStore;

const StoreContext = createContext<StoreHook>(useSystemStore);

interface StoreProviderProps {
  mode: 'demo' | 'live';
  children: ReactNode;
}

export function StoreProvider({ mode, children }: StoreProviderProps) {
  const store = mode === 'demo' ? useSystemStore : useSystemStore;
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const useStoreHook = useContext(StoreContext);
  return useStoreHook();
}