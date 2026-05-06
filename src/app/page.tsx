'use client';

import { LoginForm } from '@/components/auth/login-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Image from 'next/image';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md shadow-2xl animate-fade-in-up border-primary/10">
        <CardHeader className="text-center space-y-6">
          {/* Contenedor principal del logo superior - Estilo Cuadrado con Bordes Redondeados */}
          <div className="mx-auto bg-primary rounded-[2.5rem] p-4 shadow-xl shadow-primary/20 flex items-center justify-center w-32 h-32">
            <div className="bg-white rounded-full p-1 shadow-inner w-full h-full flex items-center justify-center overflow-hidden">
              <Image 
                src="/reloj.ico" 
                alt="Clock Logo" 
                width={100} 
                height={100} 
                className="w-[95%] h-[95%] object-contain" 
              />
            </div>
          </div>
          
          <div className="space-y-1">
            <CardTitle className="text-4xl font-black font-headline tracking-tighter uppercase text-zinc-900">
              OVERTIME
            </CardTitle>
            <CardDescription className="text-sm font-medium text-muted-foreground">
              Acceso inteligente mediante PIN único
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <LoginForm />
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground uppercase font-bold tracking-widest opacity-50">
              Derechos Reservados, 2026
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
