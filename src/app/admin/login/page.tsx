'use client';

import { AdminLoginForm } from '@/components/auth/admin-login-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Shield } from 'lucide-react';

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center p-4 bg-muted/40">
      <Card className="w-full max-w-md shadow-lg animate-fade-in-up">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary text-primary-foreground rounded-full p-3 w-fit mb-4">
            <Shield className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl font-headline">
            Panel de Administrador
          </CardTitle>
          <CardDescription>
            Ingresa tus credenciales para acceder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminLoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
