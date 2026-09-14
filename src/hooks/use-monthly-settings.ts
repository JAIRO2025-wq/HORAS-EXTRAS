'use client';

import { useEffect, useState } from 'react';
import type { MonthlySettings } from '@/lib/quincena-utils';

/**
 * Carga la configuración de quincenas del mes contable del colaborador.
 * Devuelve null mientras carga o si no hay sesión.
 */
export function useMonthlySettings() {
  const [settings, setSettings] = useState<MonthlySettings | null>(null);
  const [month, setMonth] = useState<string>('');

  useEffect(() => {
    const stored = localStorage.getItem('overtimeUser');
    if (!stored) return;

    let parsed: any;
    try {
      parsed = JSON.parse(stored);
    } catch {
      return;
    }
    if (!parsed?.month) return;

    setMonth(parsed.month);

    fetch(`/api/settings?month=${encodeURIComponent(parsed.month)}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data && typeof data.quincena1_active === 'boolean') {
          setSettings(data);
        }
      })
      .catch(() => {});
  }, []);

  return { settings, month };
}
