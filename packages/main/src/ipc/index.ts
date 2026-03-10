import { registerProjectHandlers } from './project';
import { registerJarHandlers } from './jar';
import { registerItemsHandlers } from './items';
import { registerRecipesHandlers } from './recipes';
import { registerTexturesHandlers } from './textures';
import { registerLlmHandlers } from './llm';

export function registerAllHandlers(): void {
  registerProjectHandlers();
  registerJarHandlers();
  registerItemsHandlers();
  registerRecipesHandlers();
  registerTexturesHandlers();
  registerLlmHandlers();
}
