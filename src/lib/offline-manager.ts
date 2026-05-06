'use client';

export type PendingAction = {
  id: string;
  url: string;
  method: string;
  body: any;
  timestamp: string;
  description: string;
};

const STORAGE_KEY = 'overtime_pending_actions';

export const OfflineManager = {
  saveAction: (action: Omit<PendingAction, 'id' | 'timestamp'>) => {
    if (typeof window === 'undefined') return;
    
    const pending: PendingAction[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const newAction: PendingAction = {
      ...action,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    
    pending.push(newAction);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
    return newAction;
  },

  getPendingActions: (): PendingAction[] => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      return [];
    }
  },

  removeAction: (id: string) => {
    if (typeof window === 'undefined') return;
    const pending = OfflineManager.getPendingActions().filter(a => a.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  },

  sync: async (onSuccess?: (desc: string) => void) => {
    if (typeof window === 'undefined' || !navigator.onLine) return;
    
    const actions = OfflineManager.getPendingActions();
    if (actions.length === 0) return;

    for (const action of actions) {
      try {
        const response = await fetch(action.url, {
          method: action.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.body),
        });

        if (response.ok) {
          OfflineManager.removeAction(action.id);
          if (onSuccess) onSuccess(action.description);
        }
      } catch (error) {
        console.error('Error sincronizando acción offline:', action.description, error);
        break;
      }
    }
  }
};