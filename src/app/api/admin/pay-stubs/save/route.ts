
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import webpush from 'web-push';

const dataDir = path.join(process.cwd(), 'data');

async function sendPushNotification(employeeName: string, month: string, quincena: string) {
  try {
    // 1. Cargar llaves VAPID
    const keysPath = path.join(dataDir, 'vapid.json');
    const keysContent = await fs.readFile(keysPath, 'utf-8');
    const keys = JSON.parse(keysContent);

    webpush.setVapidDetails(
      'mailto:admin@flynet.com',
      keys.publicKey,
      keys.privateKey
    );

    // 2. Cargar suscripciones
    const subsPath = path.join(dataDir, 'push_subscriptions.json');
    const subsContent = await fs.readFile(subsPath, 'utf-8');
    const subscriptions = JSON.parse(subsContent);

    const subscription = subscriptions[employeeName];

    if (subscription) {
      const payload = JSON.stringify({
        title: 'OVERTIME: Nuevo Recibo Disponible',
        body: `Hola ${employeeName.split(' ')[0]}, ya puedes revisar tu recibo de la Q${quincena} de ${month}.`,
        url: '/dashboard?tab=paystubs'
      });

      await webpush.sendNotification(subscription, payload);
      console.log(`Notificación enviada a ${employeeName}`);
    }
  } catch (error) {
    console.error('No se pudo enviar la notificación push:', error);
  }
}

export async function POST(request: Request) {
  try {
    const { employeeName, year, month, quincena, fileDataUri } = await request.json();

    if (!employeeName || !year || !month || !quincena || !fileDataUri) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const targetFolder = path.join(dataDir, 'pay-stubs', year, month, `Q${quincena}`);
    await fs.mkdir(targetFolder, { recursive: true });

    const cleanName = employeeName.replace(/[^a-z0-9]/gi, '_').toUpperCase();
    const fileName = `${cleanName}.pdf`;
    const filePath = path.join(targetFolder, fileName);

    const base64Data = fileDataUri.split(';base64,').pop();
    if (!base64Data) {
        throw new Error('Invalid file data format');
    }
    const buffer = Buffer.from(base64Data, 'base64');

    await fs.writeFile(filePath, buffer);

    // DISPARAR NOTIFICACIÓN PUSH
    // No esperamos a que termine para no bloquear la respuesta de la API
    sendPushNotification(employeeName, month, quincena);

    return NextResponse.json({ success: true, path: filePath });

  } catch (error) {
    console.error('Error saving pay stub:', error);
    return NextResponse.json({ error: 'Failed to save pay stub' }, { status: 500 });
  }
}
