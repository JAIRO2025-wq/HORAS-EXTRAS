'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage,
  FormDescription
} from '@/components/ui/form';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, FolderArchive, Upload, CheckCircle2, X, FileSearch, Image as ImageIcon } from 'lucide-react';

const DOC_TYPES = [
  "PERMANENCIA ISSS",
  "CONSTANCIA MEDICA",
  "TITULO / DIPLOMA",
  "CONSTANCIA LABORAL",
  "ANTECEDENTES PENALES",
  "SOLVENCIA POLICIAL",
  "DUI / NIT",
  "OTRO DOCUMENTO..."
];

const FormSchema = z.object({
  documentType: z.string().min(1, "Selecciona el tipo de documento"),
  notes: z.string().optional(),
});

export function HistoryForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [fileDataUri, setFileDataUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: { documentType: "", notes: "" }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Archivo muy grande', description: 'El límite es de 10MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setFileDataUri(event.target?.result as string);
      setFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    if (!fileDataUri) {
      toast({ variant: 'destructive', title: 'Archivo Requerido', description: 'Selecciona un documento para subir.' });
      return;
    }

    setIsUploading(true);
    try {
      const response = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          fileName,
          fileDataUri
        })
      });

      if (response.ok) {
        toast({ title: 'Documento Guardado', description: 'Se ha integrado correctamente a tu expediente digital.' });
        onSuccess();
      } else {
        throw new Error("Error en servidor");
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo subir el archivo.' });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="bg-white">
      <CardHeader className="bg-primary text-white p-6">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <FolderArchive className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-xl font-black uppercase tracking-tight">Subir Documento</CardTitle>
            <CardDescription className="text-white/80 text-xs font-bold uppercase tracking-widest">Expediente Digital del Colaborador</CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <div className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="documentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Documento</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Selecciona el tipo de documento" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DOC_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
                <FormLabel>Archivo Digital (PDF o Imagen)</FormLabel>
                {!fileDataUri ? (
                  <div className="relative border-2 border-dashed border-primary/20 rounded-2xl p-10 text-center hover:bg-primary/5 transition-colors cursor-pointer group">
                    <input type="file" accept=".pdf,image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange} />
                    <Upload className="h-12 w-12 mx-auto text-primary/40 mb-4 group-hover:scale-110 transition-transform" />
                    <p className="text-sm font-bold text-zinc-600">Clic para seleccionar archivo</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Soporta PDF, JPG, PNG hasta 10MB</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-4 bg-green-50 border-2 border-green-200 rounded-2xl animate-in zoom-in-95 duration-300">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-600 text-white p-2 rounded-lg">
                        {fileName?.toLowerCase().endsWith('.pdf') ? <FileSearch className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-green-900 truncate max-w-[220px]">{fileName}</span>
                        <span className="text-[10px] text-green-700 font-bold uppercase flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> ARCHIVO LISTO</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => { setFileDataUri(null); setFileName(null); }}>
                        <X className="h-5 w-5" />
                    </Button>
                  </div>
                )}
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas Adicionales (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Ej: Corresponde al mes de Junio 2026..." className="resize-none min-h-[80px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full h-14 text-lg font-bold gap-3 shadow-xl" disabled={isUploading}>
              {isUploading ? <Loader2 className="animate-spin h-6 w-6" /> : <Send className="h-6 w-6" />}
              Subir al Expediente
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
