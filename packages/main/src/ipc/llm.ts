import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';
import type { 
  IpcResponse, 
  LlmConvertData, 
  LlmConvertResult, 
  LlmConvertProgress 
} from '@delightify/shared';

// Track ongoing conversion for cancellation
let isConversionActive = false;
let currentConversionId: string | null = null;

/**
 * Generate unique conversion ID
 */
function generateConversionId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function registerLlmHandlers(): void {
  // LLM_CONVERT: Convert text to recipes using LLM with streaming progress
  ipcMain.handle(IPC_CHANNELS.LLM_CONVERT, async (
    event, 
    data: LlmConvertData
  ): Promise<IpcResponse<LlmConvertResult>> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const conversionId = generateConversionId();
    
    try {
      isConversionActive = true;
      currentConversionId = conversionId;

      const { text, options } = data || {};
      console.log('llm:convert', { text: text?.substring(0, 100), options, conversionId });

      if (!text || typeof text !== 'string') {
        isConversionActive = false;
        return { success: false, error: 'Text input is required' };
      }

      // M0 placeholder: Simulate LLM conversion with progress steps
      const steps = [
        { percent: 10, status: 'analyzing', message: 'Analyzing input text...' },
        { percent: 30, status: 'processing', message: 'Processing with LLM...' },
        { percent: 50, status: 'processing', message: 'Generating recipe structure...' },
        { percent: 70, status: 'processing', message: 'Validating recipe data...' },
        { percent: 90, status: 'finalizing', message: 'Finalizing results...' },
        { percent: 100, status: 'complete', message: 'Conversion complete!' },
      ];

      for (const step of steps) {
        // Check if conversion was cancelled
        if (!isConversionActive || currentConversionId !== conversionId) {
          const progress: LlmConvertProgress = {
            percent: 0,
            status: 'cancelled',
            message: 'Conversion was cancelled',
          };
          win?.webContents.send(IPC_CHANNELS.LLM_CONVERT_PROGRESS, progress);
          return { success: false, error: 'Conversion was cancelled' };
        }

        const progress: LlmConvertProgress = {
          percent: step.percent,
          status: step.status,
          message: step.message,
        };
        win?.webContents.send(IPC_CHANNELS.LLM_CONVERT_PROGRESS, progress);
        
        // Simulate processing delay
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // M0 placeholder: Return empty results (M2 will implement actual LLM integration)
      const result: LlmConvertResult = {
        results: [],
        status: 'complete',
      };

      isConversionActive = false;
      return { success: true, data: result };
    } catch (error) {
      isConversionActive = false;
      const errorMessage = error instanceof Error ? error.message : 'LLM conversion failed';
      console.error('LLM_CONVERT error:', error);
      
      // Send error progress
      const errorProgress: LlmConvertProgress = {
        percent: 0,
        status: 'error',
        message: errorMessage,
      };
      win?.webContents.send(IPC_CHANNELS.LLM_CONVERT_PROGRESS, errorProgress);
      
      return { success: false, error: errorMessage };
    }
  });

  // LLM_CANCEL: Cancel ongoing LLM conversion
  ipcMain.handle(IPC_CHANNELS.LLM_CANCEL, async (): Promise<IpcResponse<{ cancelled: boolean }>> => {
    try {
      console.log('llm:cancel');

      if (!isConversionActive) {
        return { success: true, data: { cancelled: false } };
      }

      isConversionActive = false;
      currentConversionId = null;

      return { success: true, data: { cancelled: true } };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel conversion';
      console.error('LLM_CANCEL error:', error);
      return { success: false, error: errorMessage };
    }
  });
}
