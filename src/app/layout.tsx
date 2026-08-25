import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { PWAHandler } from '@/components/pwa-handler';

export const metadata: Metadata = {
  title: 'Overtime Flynet',
  description: 'Gestión de horas extra y asistencia Flynet',
  manifest: '/manifest.json',
  icons: {
    icon: '/reloj.ico',
    apple: '/icon-192x192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Overtime',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#0ea5e9',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full" translate="no">
      <head>
        <meta name="google" content="notranslate" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Overtime" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <link rel="manifest" href="/manifest.json" crossOrigin="use-credentials" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function () {
  var KEY = 'overtime_chunk_reload';
  function isChunkError(msg) {
    if (typeof msg !== 'string') return false;
    return msg.indexOf('ChunkLoadError') !== -1 || /Loading chunk .* failed/.test(msg);
  }
  function reloadPage() {
    var now = Date.now();
    var last = 0;
    try { last = parseInt(sessionStorage.getItem(KEY) || '0', 10); } catch (e) {}
    if (now - last < 10000) return;
    try { sessionStorage.setItem(KEY, String(now)); } catch (e) {}
    window.location.reload();
  }
  window.addEventListener('error', function (event) {
    if (event && isChunkError(event.message)) reloadPage();
  });
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;
    var msg = reason && reason.message ? reason.message : String(reason);
    if (isChunkError(msg)) reloadPage();
  });
})();`,
          }}
        />
      </head>
      <body className="font-body antialiased h-full">
        <PWAHandler />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
