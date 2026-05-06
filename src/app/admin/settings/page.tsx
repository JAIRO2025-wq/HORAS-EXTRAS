'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getDaysInMonth } from 'date-fns';
import { months } from '@/lib/data';

type Settings = {
  quincena1_active: boolean;
  quincena2_active: boolean;
  quincena1_cutoff: number;
  quincena2_cutoff: number;
};

type AdminUser = {
  admin: boolean;
  month: string;
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [daysInMonth, setDaysInMonth] = useState<number[]>([]);
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const storedAdmin = localStorage.getItem('overtimeAdmin');
    let monthForDays: string | null = null;
    if (storedAdmin) {
      const parsedAdmin = JSON.parse(storedAdmin) as AdminUser;
      setAdminUser(parsedAdmin);
      monthForDays = parsedAdmin.month;
    }

    if (!monthForDays) return;

    const monthIndex = months.indexOf(monthForDays);
    const now = new Date();
    let year = now.getFullYear();

    const totalDays = getDaysInMonth(new Date(year, monthIndex));
    setDaysInMonth(Array.from({ length: totalDays }, (_, i) => i + 1));

    const fetchSettings = async () => {
      if (!monthForDays) return;
      try {
        const response = await fetch(`/api/settings?month=${encodeURIComponent(monthForDays)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch settings');
        }
        const data: Settings = await response.json();
        setSettings({
          ...data,
          quincena2_cutoff: Math.min(data.quincena2_cutoff, totalDays),
        });
      } catch (error) {
        console.error(error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudo cargar la configuración del servidor.',
        });
      }
    };
    fetchSettings();
  }, [toast]);

  const handleSettingChange = async (
    key: keyof Settings,
    value: boolean | number
  ) => {
    if (!settings || !adminUser) return;

    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/settings?month=${encodeURIComponent(adminUser.month)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      let description = '';
      if (key === 'quincena1_active' || key === 'quincena2_active') {
        description = `La ${
          key === 'quincena1_active' ? '1ra' : '2da'
        } quincena ha sido ${value ? 'activada' : 'desactivada'}.`;
      } else if (key === 'quincena1_cutoff') {
        description = `El día de corte de la 1ra quincena se cambió a ${value}.`;
      } else if (key === 'quincena2_cutoff') {
        description = `El día de corte de la 2da quincena se cambió a ${value}.`;
      }

      toast({
        title: 'Configuración Guardada',
        description,
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error al Guardar',
        description: 'No se pudo guardar la configuración. Revisa la consola.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Activación de Quincenas</CardTitle>
          <CardDescription>
            Activa o desactiva la posibilidad de que los empleados registren
            horas para cada quincena del mes de {adminUser?.month}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
            <div className="space-y-0.5">
              <h4 className="font-semibold text-base">1ra Quincena</h4>
              <p className="text-sm text-muted-foreground">
                Permitir registros en la primera quincena del mes.
              </p>
            </div>
            <Switch
              checked={settings.quincena1_active}
              onCheckedChange={(value) =>
                handleSettingChange('quincena1_active', value)
              }
              disabled={isSaving}
              aria-label="Toggle 1ra Quincena"
            />
          </div>
          <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
            <div className="space-y-0.5">
              <h4 className="font-semibold text-base">2da Quincena</h4>
              <p className="text-sm text-muted-foreground">
                Permitir registros en la segunda quincena del mes.
              </p>
            </div>
            <Switch
              checked={settings.quincena2_active}
              onCheckedChange={(value) =>
                handleSettingChange('quincena2_active', value)
              }
              disabled={isSaving}
              aria-label="Toggle 2da Quincena"
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Fechas de Corte</CardTitle>
          <CardDescription>
            Define los días en que terminan las quincenas para el cálculo de
            horas en {adminUser?.month}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
            <div>
              <Label htmlFor="q1-cutoff" className="font-semibold text-base">
                Día Final de la 1ra Quincena
              </Label>
              <p className="text-sm text-muted-foreground">
                El día del mes que se considera el último de la primera quincena
                (inclusivo).
              </p>
            </div>
            <Select
              value={(settings.quincena1_cutoff || '').toString()}
              onValueChange={(value) =>
                handleSettingChange('quincena1_cutoff', parseInt(value, 10))
              }
              disabled={!adminUser || daysInMonth.length === 0 || isSaving}
            >
              <SelectTrigger id="q1-cutoff" className="w-28">
                <SelectValue placeholder="Día" />
              </SelectTrigger>
              <SelectContent>
                {daysInMonth.map((day) => (
                  <SelectItem key={day} value={day.toString()}>
                    Día {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between space-x-2 rounded-lg border p-4 mt-4">
            <div>
              <Label htmlFor="q2-cutoff" className="font-semibold text-base">
                Día Final de la 2da Quincena
              </Label>
              <p className="text-sm text-muted-foreground">
                El día del mes que se considera el último de la segunda quincena
                (inclusivo).
              </p>
            </div>
            <Select
              value={(settings.quincena2_cutoff || '').toString()}
              onValueChange={(value) =>
                handleSettingChange('quincena2_cutoff', parseInt(value, 10))
              }
              disabled={!adminUser || daysInMonth.length === 0 || isSaving}
            >
              <SelectTrigger id="q2-cutoff" className="w-28">
                <SelectValue placeholder="Día" />
              </SelectTrigger>
              <SelectContent>
                {daysInMonth.map((day) => (
                  <SelectItem key={day} value={day.toString()}>
                    Día {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
