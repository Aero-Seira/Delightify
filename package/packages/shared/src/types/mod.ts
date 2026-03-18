export interface Mod {
  modId: string;
  modName: string;
  version?: string;
  mcVersion?: string;
  sourceType: 'builtin' | 'jar' | 'manual';
  jarPath?: string;
  parsedAt?: string;
  itemCount: number;
  recipeCount: number;
}
