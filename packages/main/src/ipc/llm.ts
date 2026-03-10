import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';

export function registerLlmHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.LLM_CONVERT, async (event, data: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender);

    // TODO: Implement LLM-based recipe conversion with streaming progress
    console.log('llm:convert', data);
    win?.webContents.send(IPC_CHANNELS.LLM_CONVERT_PROGRESS, {
      percent: 100,
      status: 'complete',
    });

    return { results: [], status: 'complete' };
  });

  ipcMain.handle(IPC_CHANNELS.LLM_CANCEL, async () => {
    // TODO: Cancel ongoing LLM conversion
    return { success: true };
  });
}
