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
  Users,
  Settings,
  Shield,
  FileText,
  CalendarDays,
  ArrowLeft,
  DollarSign,
  Printer,
  KeyRound,
  Building,
  Laptop,
  Clock,
  FileBadge,
  Bell,
  Scale,
  ShieldCheck,
  Gavel,
} from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { months } from '@/lib/data';

type AdminUser = {
  admin: boolean;
  role: string;
  name: string;
  month: string;
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isClient, setIsClient] = useState(false);
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
    if (pathname === '/admin/login') return;

    const storedAdmin = localStorage.getItem('overtimeAdmin');
    if (storedAdmin) {
      setAdminUser(JSON.parse(storedAdmin));
      fetchNotifCount();
      
      window.addEventListener('refresh-notifications', fetchNotifCount);
      const interval = setInterval(fetchNotifCount, 30000);
      
      return () => {
        window.removeEventListener('refresh-notifications', fetchNotifCount);
        clearInterval(interval);
      };
    }
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    localStorage.removeItem('overtimeAdmin');
    router.push('/admin/login');
  };

  const handleMonthChange = (newMonth: string) => {
    if (adminUser) {
      const newAdminUser = { ...adminUser, month: newMonth };
      setAdminUser(newAdminUser);
      localStorage.setItem('overtimeAdmin', JSON.stringify(newAdminUser));
      window.location.reload();
    }
  };

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  if (!isClient || !adminUser) {
    return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  const navLinks = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: Home },
    { href: '/admin/notifications', label: 'Notificaciones', icon: Bell, badge: unreadNotifs },
    { href: '/admin/attendance', label: 'Asistencia', icon: Clock },
    { href: '/admin/permits', label: 'Permisos RRHH', icon: Scale },
    { href: '/admin/warnings', label: 'Amonestaciones', icon: Gavel },
    { href: '/admin/employees', label: 'Empleados', icon: Users },
    { href: '/admin/admins', label: 'Administradores', icon: ShieldCheck },
    { href: '/admin/branches', label: 'Sucursales', icon: Building },
    { href: '/admin/devices', label: 'Dispositivos', icon: Laptop },
    { href: '/admin/pins', label: 'PINs de Empleados', icon: KeyRound },
    { href: '/admin/payroll', label: 'Nómina', icon: DollarSign },
    { href: '/admin/pay-stubs', label: 'Recibos PDF', icon: FileBadge },
    { href: '/admin/reports', label: 'Reportes', icon: FileText },
    { href: '/admin/pdf', label: 'PDF', icon: Printer },
    { href: '/admin/settings', label: 'Configuración', icon: Settings },
  ];

  const showBackButton = pathname !== '/admin/dashboard';

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar collapsible="icon" className="border-r shadow-sm bg-background">
          <SidebarHeader className="p-4 flex flex-row items-center gap-3">
            <Image src="/reloj.ico" alt="Logo" width={32} height={32} className="h-8 w-8 shrink-0" />
            <div className="flex flex-col group-data-[collapsible=icon]:hidden overflow-hidden">
              <span className="font-black text-sm leading-tight truncate">ADMIN PANEL</span>
              <span className="text-[10px] text-primary uppercase font-bold truncate">{adminUser.name}</span>
            </div>
          </SidebarHeader>
          <SidebarContent className="px-2 bg-background">
            <SidebarMenu>
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <SidebarMenuItem key={link.href}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive} 
                      tooltip={link.label}
                      className="h-10 hover:bg-primary/5"
                    >
                      <Link href={link.href}>
                        <Icon className={isActive ? "text-primary" : "text-muted-foreground"} />
                        <span className={isActive ? "font-bold text-primary" : "font-medium"}>{link.label}</span>
                        {link.badge ? (
                          <Badge className="ml-auto bg-primary text-white h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                            {link.badge}
                          </Badge>
                        ) : null}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t group-data-[collapsible=icon]:p-2 bg-background">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                  <LogOut className="h-4 w-4" />
                  <span>Cerrar Sesión</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex flex-col bg-background">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-card/80 backdrop-blur-md px-4 lg:h-[60px] lg:px-6">
            <SidebarTrigger />
            
            {showBackButton && (
              <Button variant="outline" size="sm" onClick={() => router.back()} className="h-9 gap-2 px-3 border-primary/20 hover:bg-primary/5 text-primary">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Regresar</span>
              </Button>
            )}

            <div className="flex-1"></div>

            <div className="flex items-center gap-4">
              <Select value={adminUser.month} onValueChange={handleMonthChange}>
                <SelectTrigger className="w-[140px] h-9">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full border border-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Administrador: {adminUser.name}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 p-4 lg:p-6 bg-background">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
