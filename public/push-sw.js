/* Solo notificaciones. No cachea páginas, respuestas, sesiones ni datos del panel. */
self.addEventListener('push', (event) => {
  let id = '';
  try {
    const payload = event.data?.json();
    if (/^[0-9a-f-]{36}$/i.test(payload?.notificationId || '')) id = payload.notificationId;
  } catch { /* El texto visible siempre es genérico. */ }
  event.waitUntil(self.registration.showNotification('MoveFlow', {
    body: 'Hay una nueva solicitud disponible. Entra a tu panel para revisarla.',
    icon: new URL('./push-icon-192.png', self.registration.scope).href,
    badge: new URL('./push-icon-192.png', self.registration.scope).href,
    tag: id ? `moveflow-${id}` : 'moveflow-nueva-solicitud',
    renotify: false,
    data: { panel: new URL('./panel.html', self.registration.scope).href },
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // La navegación es fija al panel propio, que exige sesión y segundo factor.
  const panel = new URL('./panel.html', self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
    const existing = clients.find((client) => client.url === panel || client.url.startsWith(`${panel}#`));
    if (existing) return existing.focus();
    return self.clients.openWindow(panel);
  }));
});
