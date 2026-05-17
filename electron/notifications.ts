import { Notification, app } from 'electron';

export function sendNotification(title: string, body: string) {
  if (!Notification.isSupported()) return;
  const notification = new Notification({
    title,
    body,
    icon: app.isPackaged
      ? require('path').join(process.resourcesPath, 'icon.ico')
      : require('path').join(__dirname, '../../resources/icon.ico'),
    silent: false,
  });
  notification.show();
}

export function notifyAutomationComplete(name: string) {
  sendNotification('Automação concluída', `"${name}" executada com sucesso.`);
}

export function notifyBackgroundSessionDone(sessionTitle: string) {
  sendNotification('Tarefa concluída', `Sessão "${sessionTitle}" finalizou em background.`);
}

export function notifyAgentError(context: string) {
  sendNotification('Ação necessária', `O agente precisa de input: ${context}`);
}

export function notifyUsageAlert(percentUsed: number) {
  sendNotification('Alerta de uso', `Você atingiu ${percentUsed}% do limite mensal de tokens.`);
}
