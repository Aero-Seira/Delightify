/**
 * 配方卡片组件 - v2.7 (修复JSON解析)
 * 
 * 支持的配方格式：
 * 1. Shaped (有序合成): { pattern: [...], key: {...}, result: {...} }
 * 2. Shapeless (无序合成): { ingredients: [...], result: {...} }
 *    - ingredients 格式: [{ items: [...] }] 或 [{ item: "..." }] 或 ["..."]
 * 3. Smelting/Cooking: { ingredient: {...}, result: {...} }
 *    - ingredient 格式: { items: [...] } 或 { item: "..." } 或 "..."
 */

import React, { useMemo, useState } from 'react';
import type { Recipe } from '@delightify/shared';
import ItemIcon from '../ItemIcon';
import styles from './style.module.css';

interface RecipeCardProps {
  recipe: Recipe;
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
}

interface RecipeSlot {
  item?: string;
  tag?: string;
  count?: number;
}

interface ParseInfo {
  hasRawJson: boolean;
  rawJsonLength: number;
  jsonType: string | undefined;
  hasPattern: boolean;
  hasKey: boolean;
  hasIngredients: boolean;
  hasIngredient: boolean;
  inputCount: number;
  firstInput: RecipeSlot | undefined;
  error?: string;
}

/**
 * 从数据中提取物品ID
 * 处理多种格式：{ items: [...] }, { item: "..." }, "...", { tag: "..." }
 */
function extractItemId(data: any): string | undefined {
  if (!data) return undefined;
  
  // 字符串格式: "minecraft:stick"
  if (typeof data === 'string') {
    return data;
  }
  
  // 对象格式
  if (typeof data === 'object') {
    // { item: "minecraft:stick" }
    if (data.item && typeof data.item === 'string') {
      return data.item;
    }
    
    // { items: ["minecraft:stick", ...] } - 取第一个
    if (data.items && Array.isArray(data.items) && data.items.length > 0) {
      const first = data.items[0];
      if (typeof first === 'string') return first;
      if (first && typeof first === 'object' && first.item) return first.item;
      return extractItemId(first); // 递归处理嵌套
    }
    
    // { tag: "minecraft:logs" }
    if (data.tag && typeof data.tag === 'string') {
      return `tag:${data.tag}`;
    }
  }
  
  return undefined;
}

/**
 * 从配方JSON提取物品
 */
function extractItemsFromRecipe(json: any): { inputs: RecipeSlot[]; output: RecipeSlot | null } {
  const inputs: RecipeSlot[] = [];
  let output: RecipeSlot | null = null;
  
  if (!json) return { inputs, output };
  
  // ===== 提取输入 =====
  
  // 1. 有序合成 (pattern + key)
  if (json.pattern && json.key) {
    // 遍历 pattern 的每个位置
    json.pattern.forEach((row: string) => {
      for (const char of row) {
        if (char !== ' ' && char !== '.') {
          const keyData = json.key[char];
          if (keyData) {
            // key 可能是数组（多个选项），取第一个
            const data = Array.isArray(keyData) ? keyData[0] : keyData;
            const itemId = extractItemId(data);
            if (itemId) {
              if (itemId.startsWith('tag:')) {
                inputs.push({ tag: itemId.slice(4) });
              } else {
                inputs.push({ item: itemId });
              }
            }
          }
        }
      }
    });
  }
  // 2. 无序合成 (ingredients 数组)
  else if (json.ingredients && Array.isArray(json.ingredients)) {
    json.ingredients.forEach((ing: any) => {
      // ingredients 可能是嵌套数组（某些模组的格式）
      const itemData = Array.isArray(ing) ? ing[0] : ing;
      
      const itemId = extractItemId(itemData);
      if (itemId) {
        if (itemId.startsWith('tag:')) {
          inputs.push({ tag: itemId.slice(4) });
        } else {
          inputs.push({ item: itemId });
        }
      }
    });
  }
  // 3. 单一输入 (ingredient)
  else if (json.ingredient) {
    const itemId = extractItemId(json.ingredient);
    if (itemId) {
      if (itemId.startsWith('tag:')) {
        inputs.push({ tag: itemId.slice(4) });
      } else {
        inputs.push({ item: itemId });
      }
    }
  }
  
  // ===== 提取输出 =====
  if (json.result) {
    if (typeof json.result === 'string') {
      output = { item: json.result, count: 1 };
    } else if (typeof json.result === 'object') {
      const item = json.result.item || json.result.id;
      if (item) {
        output = { item, count: json.result.count || 1 };
      }
    }
  }
  
  return { inputs, output };
}

/**
 * 配方卡片
 */
export default function RecipeCard({
  recipe,
  selected = false,
  onClick,
  onDoubleClick,
}: RecipeCardProps): React.ReactElement {
  const [showDebug, setShowDebug] = useState(false);
  
  const { inputs, output, isShaped, parseInfo } = useMemo(() => {
    try {
      const json = recipe.rawJson ? JSON.parse(recipe.rawJson) : null;
      const { inputs, output } = extractItemsFromRecipe(json);
      
      // 收集解析信息用于调试
      const parseInfo: ParseInfo = {
        hasRawJson: !!recipe.rawJson,
        rawJsonLength: recipe.rawJson?.length || 0,
        jsonType: json?.type,
        hasPattern: !!json?.pattern,
        hasKey: !!json?.key,
        hasIngredients: !!json?.ingredients,
        hasIngredient: !!json?.ingredient,
        inputCount: inputs.length,
        firstInput: inputs[0],
      };
      
      return {
        inputs,
        output,
        isShaped: !!json?.pattern,
        parseInfo,
      };
    } catch (e) {
      console.error('[RecipeCard] Parse error:', e);
      return { 
        inputs: [], 
        output: null, 
        isShaped: false, 
        parseInfo: { 
          hasRawJson: !!recipe.rawJson,
          rawJsonLength: recipe.rawJson?.length || 0,
          jsonType: undefined,
          hasPattern: false,
          hasKey: false,
          hasIngredients: false,
          hasIngredient: false,
          inputCount: 0,
          firstInput: undefined,
          error: String(e) 
        } as ParseInfo
      };
    }
  }, [recipe.rawJson, recipe.recipeId, recipe.typeId]);
  
  const typeName = recipe.typeId.split(':')[1]?.replace(/_/g, ' ') || recipe.typeId;
  const typeColor = recipe.typeId.includes('shaped') ? '#4dabf7' : 
                    recipe.typeId.includes('shapeless') ? '#69db7c' :
                    recipe.typeId.includes('smelt') || recipe.typeId.includes('cook') ? '#ff8787' : '#868e96';

  return (
    <div
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      style={{
        background: '#2d2d2d',
        border: '1px solid #3d3d3d',
        borderRadius: 12,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minWidth: 200,
      }}
    >
      {/* 类型标签 */}
      <div style={{ 
        backgroundColor: `${typeColor}20`, 
        color: typeColor,
        fontSize: 12,
        fontWeight: 500,
        padding: '3px 10px',
        borderRadius: 6,
        display: 'inline-block',
        width: 'fit-content',
      }}>
        {typeName}
      </div>

      {/* 配方内容 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '8px 0',
        minHeight: 80,
      }}>
        {/* 输入区域 */}
        <div style={{
          display: 'flex',
          flexDirection: isShaped ? 'column' : 'row',
          gap: 2,
          padding: isShaped ? 4 : 0,
          background: isShaped ? '#3d3d3d' : 'transparent',
          borderRadius: 6,
          minWidth: isShaped ? 80 : 'auto',
          minHeight: isShaped ? 80 : 40,
        }}>
          {isShaped ? (
            // 有序合成 - 3行3列网格
            [0, 1, 2].map(row => (
              <div key={row} style={{ display: 'flex', gap: 2 }}>
                {[0, 1, 2].map(col => {
                  const idx = row * 3 + col;
                  const slot = inputs[idx];
                  return (
                    <div
                      key={col}
                      style={{
                        width: 24,
                        height: 24,
                        background: slot ? '#4a4a4a' : '#2d2d2d',
                        border: '1px solid #5d5d5d',
                        borderRadius: 3,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}
                      title={slot?.item || slot?.tag || '空'}
                    >
                      {slot ? (
                        <ItemIcon 
                          itemId={slot.item || (slot.tag ? `tag:${slot.tag}` : '')} 
                          size={22}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))
          ) : (
            // 无序合成或其他
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 100 }}>
              {inputs.length > 0 ? (
                inputs.slice(0, 4).map((slot, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: 32,
                      height: 32,
                      background: '#3d3d3d',
                      border: '1px solid #4d4d4d',
                      borderRadius: 4,
                    }}
                  >
                    <ItemIcon 
                      itemId={slot.item || (slot.tag ? `tag:${slot.tag}` : '')} 
                      size={30}
                    />
                  </div>
                ))
              ) : (
                <span style={{ color: '#ff6b6b', fontSize: 11 }}>
                  无输入 ({parseInfo.inputCount})
                </span>
              )}
              {inputs.length > 4 && (
                <span style={{ color: '#868e96', fontSize: 10 }}>
                  +{inputs.length - 4}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 箭头 */}
        <span style={{ color: '#adb5bd', fontSize: 20 }}>→</span>

        {/* 输出 */}
        <div
          style={{
            width: 48,
            height: 48,
            background: output ? '#3d3d3d' : '#2d2d2d',
            border: '1px solid #4d4d4d',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {output ? (
            <>
              <ItemIcon itemId={output.item || ''} size={46} />
              {/* 数量指示器 */}
              {(output.count || 1) > 1 && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    right: 2,
                    fontSize: 11,
                    fontWeight: 'bold',
                    color: '#fff',
                    textShadow: '1px 1px 0 #000',
                    pointerEvents: 'none',
                  }}
                >
                  {output.count}
                </span>
              )}
            </>
          ) : (
            <span style={{ color: '#868e96' }}>?</span>
          )}
        </div>
      </div>

      {/* 底部信息 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        paddingTop: 8,
        borderTop: '1px solid #3d3d3d',
        fontSize: 11,
      }}>
        <span style={{ color: '#868e96' }}>{recipe.modid}</span>
        <button
          onClick={(e) => { e.stopPropagation(); setShowDebug(!showDebug); }}
          style={{
            background: 'none',
            border: 'none',
            color: '#4dabf7',
            cursor: 'pointer',
            fontSize: 10,
            padding: '2px 6px',
          }}
        >
          {showDebug ? '隐藏' : '调试'}
        </button>
      </div>
      
      {/* 调试信息面板 */}
      {showDebug && (
        <div style={{
          marginTop: 8,
          padding: 8,
          background: '#1a1a1a',
          borderRadius: 6,
          fontSize: 10,
          fontFamily: 'monospace',
          color: '#adb5bd',
          maxHeight: 150,
          overflow: 'auto',
        }}>
          <div><b>解析诊断:</b></div>
          <div>hasRawJson: {parseInfo.hasRawJson ? '✓' : '✗'}</div>
          <div>rawJsonLength: {parseInfo.rawJsonLength}</div>
          <div>type: {parseInfo.jsonType || 'N/A'}</div>
          <div>hasPattern: {parseInfo.hasPattern ? '✓' : '✗'}</div>
          <div>hasKey: {parseInfo.hasKey ? '✓' : '✗'}</div>
          <div>hasIngredients: {parseInfo.hasIngredients ? '✓' : '✗'}</div>
          <div>hasIngredient: {parseInfo.hasIngredient ? '✓' : '✗'}</div>
          <div>inputCount: {parseInfo.inputCount}</div>
          <div>firstInput: {JSON.stringify(parseInfo.firstInput)}</div>
          {parseInfo.error && <div style={{ color: '#ff6b6b' }}>error: {parseInfo.error}</div>}
        </div>
      )}
    </div>
  );
}

/**
 * 列表行组件
 */
export function RecipeListRow({
  recipe,
  selected = false,
  onClick,
  onDoubleClick,
}: RecipeCardProps): React.ReactElement {
  const { inputs, output } = useMemo(() => {
    try {
      const json = recipe.rawJson ? JSON.parse(recipe.rawJson) : null;
      return extractItemsFromRecipe(json);
    } catch {
      return { inputs: [], output: null };
    }
  }, [recipe.rawJson]);

  return (
    <div
      className={`${styles.listRow} ${selected ? styles.selected : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        background: '#2d2d2d',
        border: '1px solid #3d3d3d',
        borderRadius: 8,
        cursor: 'pointer',
      }}
    >
      <span style={{ 
        backgroundColor: '#3d3d3d',
        color: '#adb5bd',
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 4,
        minWidth: 80,
        textAlign: 'center',
      }}>
        {recipe.typeId.split(':')[1] || 'unknown'}
      </span>
      
      <div style={{ display: 'flex', gap: 4 }}>
        {inputs.slice(0, 3).map((slot, idx) => (
          <div key={idx} style={{ width: 24, height: 24 }}>
            <ItemIcon itemId={slot.item || (slot.tag ? `tag:${slot.tag}` : '')} size={24} />
          </div>
        ))}
      </div>

      <span style={{ color: '#adb5bd' }}>→</span>

      <div style={{ width: 28, height: 28, position: 'relative' }}>
        {output && (
          <>
            <ItemIcon itemId={output.item || ''} size={28} />
            {(output.count || 1) > 1 && (
              <span
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  fontSize: 9,
                  fontWeight: 'bold',
                  color: '#fff',
                  textShadow: '1px 1px 0 #000',
                  pointerEvents: 'none',
                }}
              >
                {output.count}
              </span>
            )}
          </>
        )}
      </div>

      <div style={{ flex: 1, marginLeft: 8 }}>
        <div style={{ fontSize: 13, color: '#e9ecef' }}>{recipe.recipeId}</div>
        <div style={{ fontSize: 11, color: '#868e96' }}>{recipe.modid}</div>
      </div>
    </div>
  );
}

/**
 * 详情卡片
 */
export function RecipeDetailCard({ recipe }: { recipe: Recipe }): React.ReactElement {
  const { inputs, output, parseInfo } = useMemo(() => {
    try {
      const json = recipe.rawJson ? JSON.parse(recipe.rawJson) : null;
      const { inputs, output } = extractItemsFromRecipe(json);
      return { 
        inputs, 
        output, 
        parseInfo: {
          hasRawJson: !!recipe.rawJson,
          jsonKeys: json ? Object.keys(json) : [],
          type: json?.type,
        }
      };
    } catch (e) {
      return { inputs: [], output: null, parseInfo: { error: String(e) } };
    }
  }, [recipe.rawJson]);
  
  const [showJson, setShowJson] = React.useState(false);

  return (
    <div style={{
      background: '#2d2d2d',
      border: '1px solid #3d3d3d',
      borderRadius: 12,
      padding: 16,
      margin: '8px 0',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottom: '1px solid #3d3d3d',
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#e9ecef' }}>
          {recipe.typeId}
        </span>
        <span style={{ fontSize: 13, color: '#868e96' }}>{recipe.modid}</span>
      </div>

      <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
        <div>
          <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#adb5bd' }}>
            输入 ({inputs.length})
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {inputs.map((slot, idx) => (
              <div key={idx} style={{ textAlign: 'center' }}>
                <div style={{ width: 48, height: 48 }}>
                  <ItemIcon itemId={slot.item || (slot.tag ? `tag:${slot.tag}` : '')} size={48} />
                </div>
                <div style={{ fontSize: 10, color: '#868e96', marginTop: 4 }}>
                  {(slot.item || slot.tag || '?').split(':').pop()?.substring(0, 10)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ paddingTop: 24, color: '#adb5bd', fontSize: 24 }}>→</div>

        <div>
          <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#adb5bd' }}>输出</h4>
          {output && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, position: 'relative' }}>
                <ItemIcon itemId={output.item || ''} size={56} />
                {(output.count || 1) > 1 && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: 2,
                      right: 2,
                      fontSize: 12,
                      fontWeight: 'bold',
                      color: '#fff',
                      textShadow: '1px 1px 0 #000',
                      pointerEvents: 'none',
                    }}
                  >
                    {output.count}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#868e96', marginTop: 4 }}>
                {output.item?.split(':').pop()}
                {output.count && output.count > 1 ? ` x${output.count}` : ''}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTop: '1px solid #3d3d3d',
      }}>
        <code style={{ fontSize: 12, color: '#868e96' }}>{recipe.recipeId}</code>
        <button 
          onClick={() => setShowJson(!showJson)}
          style={{
            padding: '4px 12px',
            border: '1px solid #4d4d4d',
            background: '#3d3d3d',
            borderRadius: 6,
            fontSize: 12,
            color: '#adb5bd',
            cursor: 'pointer',
          }}
        >
          {showJson ? '隐藏 JSON' : '查看 JSON'}
        </button>
      </div>

      {showJson && recipe.rawJson && (
        <pre style={{
          marginTop: 12,
          padding: 12,
          background: '#1a1a1a',
          borderRadius: 8,
          fontSize: 12,
          color: '#adb5bd',
          overflow: 'auto',
          maxHeight: 300,
        }}>{JSON.stringify(JSON.parse(recipe.rawJson), null, 2)}</pre>
      )}
    </div>
  );
}
