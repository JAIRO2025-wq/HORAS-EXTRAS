'use client';

import { 
  SidebarProvider, 
  Sidebar, 
  SidebarContent, 
  SidebarHeader, 
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LogOut,
  User,
  Home,
  Clock,
  Timer,
  FileBadge,
  Scale,
  CalendarDays,
  Loader2,
  FileSearch,
  Bell,
} from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import type { Employee, Branch } from '@/lib/types';

type User = {
  name: string;
  month: string;
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isAttendanceVisible, setIsAttendanceVisible] = useState(false);
  const [isLoadingPerms, setIsLoadingPerms] = useState(true);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const router = useRouter();
  const pathname = usePathname();

  const fetchNotifCount = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setUnreadNotifs(data.filter((n: any) => !n.read).length);
      }
    } catch (e) {}
  };

  useEffect(() => {
    setIsClient(true);
    const storedUser = localStorage.getItem('overtimeUser');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      checkPermissions(parsedUser.name);
      fetchNotifCount();

      // Escuchar eventos de actualización manual desde el NotificationCenter
      window.addEventListener('refresh-notifications', fetchNotifCount);

      // Polling para notificaciones en tiempo real
      const interval = setInterval(fetchNotifCount, 30000);
      
      return () => {
        window.removeEventListener('refresh-notifications', fetchNotifCount);
        clearInterval(interval);
      };
    } else {
      router.replace('/');
    }
  }, [router]);

  const checkPermissions = async (name: string) => {
    try {
      const [empRes, branchRes] = await Promise.all([
        fetch('/api/employees'),
        fetch('/api/branches')
      ]);
      
      const employees: Employee[] = await empRes.json();
      const branches: Branch[] = await branchRes.json();
      const me = employees.find(e => e.name === name);
      
      if (me) {
        const myBranch = branches.find(b => b.name === me.branch);
        const localDeviceId = localStorage.getItem('overtimeDeviceId');
        
        if (myBranch) {
          const isEnabled = !!myBranch.isAttendanceEnabled;
          const isAuthorizedDevice = myBranch.isUnrestricted || !myBranch.deviceId || myBranch.deviceId === localDeviceId;
          setIsAttendanceVisible(isEnabled && isAuthorizedDevice);
        }
      }
    } catch (e) {
      console.error("Error checking sidebar perms:", e);
    } finally {
      setIsLoadingPerms(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('overtimeUser');
    router.push('/');
  };

  const navItems = useMemo(() => {
    const base = [
      { label: 'Panel Principal', icon: Home, value: 'home' },
    ];

    if (isAttendanceVisible) {
      base.push({ label: 'Asistencia', icon: Clock, value: 'attendance' });
    }

    base.push(
      { label: 'Horas Extra', icon: Timer, value: 'overtime' },
      { label: 'Inasistencias', icon: FileSearch, value: 'inasistencias' },
      { label: 'Recibos Pago', icon: FileBadge, value: 'paystubs' },
      { label: 'Permisos RRHH', icon: Scale, value: 'permits' }
    );

    return base;
  }, [isAttendanceVisible]);

  if (!isClient || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar collapsible="icon" className="border-r shadow-sm bg-background opacity-100">
          <SidebarHeader className="p-4 flex flex-row items-center gap-3">
            <Image src="/reloj.ico" alt="Logo" width={32} height={32} className="h-8 w-8 shrink-0" />
            <span className="font-black text-xl font-headline group-data-[collapsible=icon]:hidden">OVERTIME</span>
          </SidebarHeader>
          <SidebarContent className="px-2 bg-background">
            {isLoadingPerms ? (
              <div className="flex justify-center p-4"><Loader2 className="h-4 w-4 animate-spin opacity-20" /></div>
            ) : (
              <SidebarMenu>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.value}>
                      <SidebarMenuButton 
                        asChild 
                        tooltip={item.label}
                        className="h-12 hover:bg-primary/5"
                      >
                        <button onClick={() => {
                          window.dispatchEvent(new CustomEvent('change-tab', { detail: item.value }));
                        }}>
                          <Icon className="h-5 w-5" />
                          <span className="font-medium">{item.label}</span>
                          {item.value === 'home' && unreadNotifs > 0 && (
                            <Badge className="ml-auto bg-primary text-white h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                              {unreadNotifs}
                            </Badge>
                          )}
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            )}
          </SidebarContent>
          <SidebarFooter className="p-4 border-t group-data-[collapsible=icon]:p-2 bg-background">
            <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="text-xs font-bold truncate">{user.name}</p>
                <p className="text-[10px] text-muted-foreground uppercase">{user.month}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 group-data-[collapsible=icon]:hidden" onClick={handleLogout}>
                <LogOut className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex flex-col bg-background">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-card/80 backdrop-blur-md px-4 sm:px-6">
            <SidebarTrigger className="sm:flex" />
            <div className="flex-1">
                <h2 className="font-bold text-sm sm:text-base hidden sm:block">Panel de Control de Tiempos</h2>
            </div>
            <div className="flex items-center gap-2">
                {unreadNotifs > 0 && (
                  <Button variant="ghost" size="icon" className="relative h-8 w-8" onClick={() => window.dispatchEvent(new CustomEvent('change-tab', { detail: 'notifications' }))}>
                    <Bell className="h-4 w-4" />
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white font-bold">
                      {unreadNotifs}
                    </span>
                  </Button>
                )}
                <Badge variant="outline" className="gap-1 px-2 h-7 font-mono text-[10px]">
                    <CalendarDays className="h-3 w-3" /> {user.month}
                </Badge>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="rounded-full h-8 w-8">
                            <User className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                            <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 bg-background">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
