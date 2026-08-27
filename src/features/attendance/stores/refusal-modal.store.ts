import { create } from 'zustand';

interface RefusalModalState {
  close: () => void;
  open: (presenceId: string) => void;
  presenceId: string | null;
}

export const useRefusalModalStore = create<RefusalModalState>((set) => ({
  close: () => set({ presenceId: null }),
  open: (presenceId) => set({ presenceId }),
  presenceId: null,
}));
