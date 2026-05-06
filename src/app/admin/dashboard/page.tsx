
'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Employee, OvertimeRecord, PermitRequest } from '@/lib/types';
import { Timer, Users, Scale, TrendingUp, BarChart3, Loader2, Sun, Moon, CalendarPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  Bar, 
  BarChart, 
  XAxis, 
  YAxis, 
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

export default function AdminDashboardPage() {
  const [records, setRecords] = useState<OvertimeRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [permits, setPermits] = useState<PermitRequest[]>([]);
  const [yearlyData, setYearlyData] = useState<any[]>([]);
  const [month, setMonth] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedAdmin = localStorage.getItem('overtimeAdmin');
    if (storedAdmin) {
      const parsedAdmin = JSON.parse(storedAdmin);
      setMonth(parsedAdmin.month);
    }
  }, []);
  
  useEffect(() => {
    if (!month) return;

    const fetchAllData = async () => {
      setIsLoading(true);
      try {
        const [recordsRes, employeesRes, permitsRes, statsRes] = await Promise.all([
          fetch(`/api/admin/all-records?month=${encodeURIComponent(month)}`),
          fetch('/api/employees'),
          fetch('/api/permits'),
          fetch('/api/admin/stats/yearly-overtime')
        ]);

        if (recordsRes.ok) setRecords(await recordsRes.json());
        if (employeesRes.ok) setEmployees(await employeesRes.json());
        if (permitsRes.ok) setPermits(await permitsRes.json());
        if (statsRes.ok) {
          const stats = await statsRes.json();
          setYearlyData(stats.data);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [month]);

  const stats = useMemo(() => {
    const approvedRecords = records.filter(r => r.status === 'approved');
    
    // Solo sumamos horas de registros tipo 'overtime' para que coincida con la gráfica
    const approvedOvertime = approvedRecords.filter(r => r.type === 'overtime');
    const totalHE = approvedOvertime.reduce((acc, r) => acc + (r.totalHours || 0), 0);
    
    // Contamos días adicionales por separado
    const additionalDays = approvedRecords.filter(r => r.type === 'additional_day').length;

    const q1Hours = approvedOvertime.filter(r => r.quincena === 1).reduce((acc, r) => acc + (r.totalHours || 0), 0);
    const q2Hours = approvedOvertime.filter(r => r.quincena === 2).reduce((acc, r) => acc + (r.totalHours || 0), 0);
    
    const pendingHR = permits.filter(p => p.status === 'pending' || p.status === 'pending_admin').length;
    const activeEmps = employees.filter(e => e.status === 'active').length;

    return {
      totalHE,
      q1Hours,
      q2Hours,
      additionalDays,
      pendingHR,
      activeEmps,
      totalEmps: employees.length
    };
  }, [records, employees, permits]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-headline">Resumen Administrativo</h1>
        <Badge variant="outline" className="px-3 py-1 font-mono">{month}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/10 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Horas Extra (HE)</CardTitle>
                <Timer className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-black text-primary">{stats.totalHE.toFixed(1)}</div>
                <p className="text-[10px] text-muted-foreground mt-1">Aprobadas en {month}</p>
            </CardContent>
        </Card>

        <Card className="border-primary/10 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Días Adicionales</CardTitle>
                <CalendarPlus className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-black">{stats.additionalDays}</div>
                <p className="text-[10px] text-muted-foreground mt-1">Días completos registrados</p>
            </CardContent>
        </Card>

        <Card className="border-primary/10 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Solicitudes RRHH</CardTitle>
                <Scale className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-black">{stats.pendingHR}</div>
                <p className="text-[10px] text-amber-600 font-bold mt-1">Pendientes de revisión</p>
            </CardContent>
        </Card>

        <Card className="border-primary/10 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fuerza Laboral</CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-black">{stats.activeEmps}</div>
                <p className="text-[10px] text-muted-foreground mt-1">Empleados activos en {stats.totalEmps}</p>
            </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        {/* GRÁFICA ANUAL SEGREGADA */}
        <Card className="md:col-span-8 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" /> Tendencia de Horas (Día/Noche)
              </CardTitle>
              <CardDescription>Acumulado por mes contable (Nómina).</CardDescription>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-tighter">
                <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-primary"></div> Diurna</div>
                <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-accent"></div> Nocturna</div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary/20" />
              </div>
            ) : (
              <ChartContainer 
                config={{ 
                    day: { label: "Diurnas", color: "hsl(var(--primary))" },
                    night: { label: "Nocturnas", color: "hsl(var(--accent))" }
                }} 
                className="h-[300px] w-full"
              >
                <BarChart data={yearlyData}>
                  <XAxis 
                    dataKey="month" 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `${value}h`}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar 
                    dataKey="day" 
                    fill="var(--color-day)" 
                    stackId="a"
                    radius={[0, 0, 0, 0]}
                    barSize={30}
                  />
                  <Bar 
                    dataKey="night" 
                    fill="var(--color-night)" 
                    stackId="a"
                    radius={[4, 4, 0, 0]}
                    barSize={30}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* DESGLOSE QUINCENAL */}
        <div className="md:col-span-4 space-y-6">
          <Card>
              <CardHeader>
                  <CardTitle className="text-lg">Corte Quincenal</CardTitle>
                  <CardDescription>Distribución HE en {month}.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-dashed text-zinc-600">
                      <div className="flex items-center gap-3">
                          <div className="bg-background p-2 rounded-lg shadow-sm font-bold text-primary">Q1</div>
                          <div>
                              <p className="text-xs font-bold">1ra Quincena</p>
                              <p className="text-[10px] text-muted-foreground">Hasta día de corte</p>
                          </div>
                      </div>
                      <div className="text-right">
                          <div className="text-lg font-black">{stats.q1Hours.toFixed(1)} h</div>
                      </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-dashed text-zinc-600">
                      <div className="flex items-center gap-3">
                          <div className="bg-background p-2 rounded-lg shadow-sm font-bold text-primary">Q2</div>
                          <div>
                              <p className="text-xs font-bold">2da Quincena</p>
                              <p className="text-[10px] text-muted-foreground">Cierre de mes</p>
                          </div>
                      </div>
                      <div className="text-right">
                          <div className="text-lg font-black">{stats.q2Hours.toFixed(1)} h</div>
                      </div>
                  </div>
              </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20 overflow-hidden relative">
            <TrendingUp className="absolute -right-4 -bottom-4 h-24 w-24 opacity-5" />
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                Balance Operativo HE
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5"><Sun className="h-3 w-3 text-primary" /> Diurnas</span>
                <span className="font-bold">{(yearlyData.find(d => d.month === month?.substring(0,3))?.day || 0).toFixed(1)}h</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5"><Moon className="h-3 w-3 text-accent" /> Nocturnas</span>
                <span className="font-bold">{(yearlyData.find(d => d.month === month?.substring(0,3))?.night || 0).toFixed(1)}h</span>
              </div>
              <p className="text-[10px] text-muted-foreground pt-2 border-t italic">
                *Los datos de esta gráfica corresponden exclusivamente a horas extra aprobadas.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
