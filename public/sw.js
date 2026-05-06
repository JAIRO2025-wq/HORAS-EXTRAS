/**
 * Service Worker para Overtime Flynet
 * Maneja notificaciones Push y estrategias de cacheo.
 */

const CACHE_NAME = 'overtime-cache-v2';

// Evento de instalación
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Escuchar mensajes push del servidor
self.addEventListener('push', (event) => {
  if (!(self.registration && self.registration.showNotification)) {
    return;
  }

  const data = event.data?.json() || {
    title: 'Overtime Flynet',
    body: 'Tienes una nueva actualización en tu panel.',
    url: '/dashboard'
  };

  const options = {
    body: data.body,
    icon: '/reloj.ico', // Icono principal
    badge: '/reloj.ico', // Usamos el mismo para evitar el icono azul genérico
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/dashboard',
      employeeName: data.employeeName,
      timestamp: data.timestamp
    },
    tag: 'overtime-notification', // Agrupa notificaciones
    renotify: true,
    actions: [
      { action: 'open', title: 'Ver Detalles' },
      { action: 'close', title: 'Cerrar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .then(() => {
        // Enviar confirmación silenciosa al servidor si es posible
        if (data.employeeName) {
          return fetch('/api/admin/notifications/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employeeName: data.employeeName,
              title: data.title,
              timestamp: data.timestamp
            })
          }).catch(err => console.log('Confirm error:', err));
        }
      })
  );
});

// Manejar el clic en la notificación
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const targetUrl = notification.data.url || '/dashboard';

  notification.close();

  if (action === 'close') {
    return;
  }

  // Lógica de navegación
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // 1. Intentar encontrar una pestaña que ya tenga la app abierta
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus().then(c => {
              // Notificar a la app el cambio de ruta/pestaña interno
              return c.navigate(targetUrl);
            });
          }
        }
        // 2. Si no hay pestañas abiertas, abrir una nueva
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});