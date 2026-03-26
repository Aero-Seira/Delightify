/**
 * 导入引擎测试工具
 * 
 * 用于测试和对比新旧导入引擎的功能
 */

import React, { useState, useCallback } from 'react';
import { useI18n } from '../../i18n';
import { electronAPI } from '../../ipc';
import styles from './style.module.css';

// 测试状态
type TestStatus = 'idle' | 'running' | 'completed' | 'error';

// 测试结果
type TestResult = {
  engine: 'old' | 'new';
  duration: number;
  items: number;
  blocks: number;
  recipes: number;
  tags: number;
  errors: string[];
  warnings: string[];
  details: {
    bytecodeAnalysis?: BytecodeAnalysisResult;
    [key: string]: unknown;
  };
};

// 字节码分析结果
type BytecodeAnalysisResult = {
  duration: number;
  items: Array<{
    id: string;
    className: string;
    maxStackSize?: number;
    durability?: number;
    isBlockItem?: boolean;
    blockId?: string;
    properties: Record<string, unknown>;
  }>;
  blocks: Array<{
    id: string;
    className: string;
    hardness?: number;
    resistance?: number;
    lightLevel?: number;
    material?: string;
    properties: Record<string, unknown>;
  }>;
  multiBlockStructures: Array<{
    baseId: string;
    modId: string;
    parts: Array<{
      id: string;
      position: string;
      variant?: string;
      state?: string;
    }>;
    confidence: number;
    detectionSource: string;
  }>;
  diagnostics: {
    javaAvailable: boolean;
    inspectorJarAvailable: boolean;
    errors: string[];
    warnings: string[];
  };
  error?: string;
};

// 对比结果
type ComparisonResult = {
  oldEngine?: TestResult;
  newEngine?: TestResult;
  differences: Array<{
    type: 'added' | 'removed' | 'modified' | 'improved';
    item: string;
    description?: string;
    oldValue?: string;
    newValue?: string;
  }>;
  bytecodeAnalysis?: BytecodeAnalysisResult;
};

export default function ImportEngineTestPage(): React.ReactElement {
  const { t } = useI18n();
  
  // 状态
  const [filePath, setFilePath] = useState('');
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'blocks' | 'structures' | 'logs'>('overview');
  const [itemFilter, setItemFilter] = useState('');

  // 选择文件
  const handleSelectFile = useCallback(async () => {
    // v2.1 暂不支持文件选择
    console.warn('File selection not supported in v2.1');
  }, []);

  // 导入到数据库 - v2.1 暂不支持
  const [importDbStatus, setImportDbStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [importDbResult, setImportDbResult] = useState<{items: number; blocks: number} | null>(null);

  const importToDatabase = useCallback(async () => {
    // v2.1 暂不支持
    console.warn('Import to database not supported in v2.1');
    setImportDbStatus('error');
  }, [filePath]);

  // 运行测试 - v2.1 暂不支持
  const runTest = useCallback(async () => {
    // v2.1 暂不支持
    console.warn('Import engine test not supported in v2.1');
    setTestStatus('error');
  }, [filePath]);

  // 渲染状态卡片
  const renderStatusCard = (title: string, value: string | number, color?: string) => (
    <div className={styles.statusCard} style={{ borderColor: color }}>
      <div className={styles.statusValue} style={{ color }}>{value}</div>
      <div className={styles.statusLabel}>{title}</div>
    </div>
  );

  // 获取过滤后的物品列表
  const filteredItems = comparison?.bytecodeAnalysis?.items.filter(item => 
    item.id.toLowerCase().includes(itemFilter.toLowerCase())
  ) || [];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>🧪 Import Engine Test Tool</h1>
        <p className={styles.subtitle}>
          Test and compare the new import engine with bytecode analysis
        </p>
      </header>

      {/* 文件选择区 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>1. Select Mod File</h2>
        <div className={styles.fileSelector}>
          <input
            type="text"
            className={styles.fileInput}
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            placeholder="Select a JAR file or extracted mod directory..."
          />
          <button className={styles.button} onClick={handleSelectFile}>
            Browse...
          </button>
        </div>
      </section>

      {/* 测试控制区 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>2. Run Tests</h2>
        <div className={styles.testControls}>
          <button
            className={`${styles.button} ${styles.primaryButton}`}
            onClick={runTest}
            disabled={!filePath || testStatus === 'running'}
          >
            {testStatus === 'running' ? 'Testing...' : 'Run Full Analysis'}
          </button>
          
          {testStatus === 'running' && (
            <div className={styles.progressContainer}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className={styles.progressLabel}>
                {Math.round(progress)}% - {progressLabel}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 导入到数据库 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>3. Import to Database</h2>
        <div className={styles.testControls}>
          <button
            className={`${styles.button} ${styles.primaryButton}`}
            onClick={importToDatabase}
            disabled={!filePath || importDbStatus === 'running'}
            style={{ backgroundColor: '#4caf50', borderColor: '#4caf50' }}
          >
            {importDbStatus === 'running' ? 'Importing...' : '💾 Import to Database'}
          </button>
          
          {importDbStatus === 'completed' && importDbResult && (
            <div className={styles.successBox}>
              ✅ Import successful! {importDbResult.items} items, {importDbResult.blocks} blocks saved to database.
            </div>
          )}
          
          {importDbStatus === 'error' && (
            <div className={styles.errorBox}>
              ❌ Import failed. Check console for details.
            </div>
          )}
        </div>
      </section>

      {/* 结果对比区 */}
      {comparison && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>3. Analysis Results</h2>
          
          {/* Tab 导航 */}
          <div className={styles.tabNav}>
            {(['overview', 'items', 'blocks', 'structures', 'logs'] as const).map((tab) => (
              <button
                key={tab}
                className={`${styles.tabButton} ${activeTab === tab ? styles.activeTab : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Tab 内容 */}
          <div className={styles.tabContent}>
            {activeTab === 'overview' && (
              <div className={styles.overviewGrid}>
                {/* 旧引擎结果 */}
                <div className={styles.engineResult}>
                  <h3 className={styles.engineTitle}>Legacy Engine (Heuristic)</h3>
                  <div className={styles.statusGrid}>
                    {renderStatusCard('Duration', `${comparison.oldEngine?.duration}ms`, '#888')}
                    {renderStatusCard('Items', comparison.oldEngine?.items || 0, '#ff9800')}
                    {renderStatusCard('Blocks', comparison.oldEngine?.blocks || 0, '#ff9800')}
                    {renderStatusCard('Recipes', comparison.oldEngine?.recipes || 0, '#9c27b0')}
                    {renderStatusCard('Tags', comparison.oldEngine?.tags || 0, '#9c27b0')}
                  </div>
                  {comparison.oldEngine?.warnings && comparison.oldEngine.warnings.length > 0 && (
                    <div className={styles.warningBox}>
                      ⚠️ {comparison.oldEngine.warnings.length} warnings
                    </div>
                  )}
                </div>

                {/* 新引擎结果 */}
                <div className={styles.engineResult}>
                  <h3 className={styles.engineTitle}>New Engine (Bytecode)</h3>
                  <div className={styles.statusGrid}>
                    {renderStatusCard('Duration', `${comparison.newEngine?.duration}ms`, '#4caf50')}
                    {renderStatusCard('Items', comparison.newEngine?.items || 0, '#4a9eff')}
                    {renderStatusCard('Blocks', comparison.newEngine?.blocks || 0, '#4caf50')}
                    {renderStatusCard('Recipes', comparison.newEngine?.recipes || 0, '#ff9800')}
                    {renderStatusCard('Tags', comparison.newEngine?.tags || 0, '#9c27b0')}
                    {renderStatusCard('Structures', comparison.bytecodeAnalysis?.multiBlockStructures.length || 0, '#e91e63')}
                  </div>
                  {comparison.newEngine?.errors && comparison.newEngine.errors.length > 0 && (
                    <div className={styles.errorBox}>
                      ❌ {comparison.newEngine.errors.length} errors
                    </div>
                  )}
                  {comparison.bytecodeAnalysis?.diagnostics && (
                    <div className={styles.diagnosticsBox}>
                      <div>Java Available: {comparison.bytecodeAnalysis.diagnostics.javaAvailable ? '✅' : '❌'}</div>
                      <div>Inspector JAR: {comparison.bytecodeAnalysis.diagnostics.inspectorJarAvailable ? '✅' : '❌'}</div>
                    </div>
                  )}
                </div>

                {/* 差异总结 */}
                <div className={styles.differenceSummary}>
                  <h3 className={styles.engineTitle}>Improvements</h3>
                  <div className={styles.diffStats}>
                    {comparison.differences.map((diff, idx) => (
                      <div key={idx} className={styles.diffRow}>
                        <span className={`${styles.diffBadge} ${styles[diff.type]}`}>
                          {diff.type}
                        </span>
                        <span className={styles.diffName}>{diff.item}</span>
                        {diff.newValue && (
                          <span className={styles.diffValue}>{diff.newValue}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'items' && (
              <div className={styles.itemList}>
                <div className={styles.filterBar}>
                  <h3>Items from Bytecode ({comparison.bytecodeAnalysis?.items.length || 0})</h3>
                  <input
                    type="text"
                    placeholder="Filter items..."
                    value={itemFilter}
                    onChange={(e) => setItemFilter(e.target.value)}
                    className={styles.filterInput}
                  />
                </div>
                <div className={styles.dataTableContainer}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>Item ID</th>
                        <th>Class</th>
                        <th>Properties</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.slice(0, 100).map((item, idx) => (
                        <tr key={idx}>
                          <td className={styles.itemId}>{item.id}</td>
                          <td className={styles.className}>{item.className.split('.').pop()}</td>
                          <td className={styles.properties}>
                            {item.isBlockItem && <span className={styles.badge}>BlockItem</span>}
                            {item.maxStackSize && item.maxStackSize !== 64 && (
                              <span className={styles.badge}>Stack: {item.maxStackSize}</span>
                            )}
                            {item.durability && (
                              <span className={styles.badge}>Dur: {item.durability}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredItems.length > 100 && (
                    <div className={styles.tableFooter}>
                      Showing 100 of {filteredItems.length} items. Use filter to narrow results.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'blocks' && (
              <div className={styles.itemList}>
                <h3>Blocks from Bytecode ({comparison.bytecodeAnalysis?.blocks.length || 0})</h3>
                <div className={styles.dataTableContainer}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>Block ID</th>
                        <th>Class</th>
                        <th>Properties</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.bytecodeAnalysis?.blocks.slice(0, 100).map((block, idx) => (
                        <tr key={idx}>
                          <td className={styles.itemId}>{block.id}</td>
                          <td className={styles.className}>{block.className.split('.').pop()}</td>
                          <td className={styles.properties}>
                            {block.hardness !== undefined && (
                              <span className={styles.badge}>Hard: {block.hardness}</span>
                            )}
                            {block.lightLevel !== undefined && block.lightLevel > 0 && (
                              <span className={styles.badge}>Light: {block.lightLevel}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'structures' && (
              <div className={styles.itemList}>
                <h3>Multi-block Structures ({comparison.bytecodeAnalysis?.multiBlockStructures.length || 0})</h3>
                <div className={styles.structureList}>
                  {comparison.bytecodeAnalysis?.multiBlockStructures.map((struct, idx) => (
                    <div key={idx} className={styles.structureCard}>
                      <div className={styles.structureHeader}>
                        <span className={styles.structureName}>{struct.baseId}</span>
                        <span className={styles.structureMeta}>
                          {struct.parts.length} parts · {Math.round(struct.confidence * 100)}% confidence
                        </span>
                      </div>
                      <div className={styles.structureParts}>
                        {struct.parts.map((part, pidx) => (
                          <span key={pidx} className={styles.partTag} title={`Position: ${part.position}`}>
                            {part.id.split(':')[1]}
                            {part.state && ` (${part.state})`}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className={styles.logs}>
                <h3>Detailed Logs</h3>
                <div className={styles.logContainer}>
                  <div className={styles.logEntry}>🚀 Test started at {new Date().toLocaleTimeString()}</div>
                  <div className={styles.logEntry}>📁 File: {filePath}</div>
                  <div className={styles.logEntry}>✅ JSON analysis completed</div>
                  {comparison.bytecodeAnalysis?.diagnostics.javaAvailable ? (
                    <>
                      <div className={styles.logEntry}>☕ Java environment detected</div>
                      <div className={styles.logEntry}>🔍 Bytecode analysis completed in {comparison.bytecodeAnalysis.duration}ms</div>
                      <div className={styles.logEntry}>📦 Found {comparison.bytecodeAnalysis.items.length} items from bytecode</div>
                      <div className={styles.logEntry}>🧱 Found {comparison.bytecodeAnalysis.blocks.length} blocks from bytecode</div>
                      <div className={styles.logEntry}>🏗️ Detected {comparison.bytecodeAnalysis.multiBlockStructures.length} multi-block structures</div>
                    </>
                  ) : (
                    <div className={styles.logEntry}>⚠️ Java not available, bytecode analysis skipped</div>
                  )}
                  {comparison.bytecodeAnalysis?.diagnostics.errors.map((err, idx) => (
                    <div key={idx} className={`${styles.logEntry} ${styles.error}`}>❌ {err}</div>
                  ))}
                  {comparison.bytecodeAnalysis?.diagnostics.warnings.map((warn, idx) => (
                    <div key={idx} className={`${styles.logEntry} ${styles.warning}`}>⚠️ {warn}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 功能说明 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>About This Tool</h2>
        <div className={styles.infoGrid}>
          <div className={styles.infoCard}>
            <h4>🔍 What It Tests</h4>
            <ul>
              <li>JAR file scanning and classification</li>
              <li>JSON parsing (recipes, tags, blockstates)</li>
              <li>Tag resolution and inlining</li>
              <li>Java bytecode analysis (items/blocks)</li>
              <li>Multi-block structure detection</li>
            </ul>
          </div>
          <div className={styles.infoCard}>
            <h4>⚡ Bytecode Analysis</h4>
            <ul>
              <li>Uses ASM library to parse Java class files</li>
              <li>Extracts real registration info from DeferredRegister</li>
              <li>Detects Forge/Fabric mod patterns</li>
              <li>Identifies multi-part blocks by naming</li>
            </ul>
          </div>
          <div className={styles.infoCard}>
            <h4>📝 How to Use</h4>
            <ol>
              <li>Select a mod JAR file</li>
              <li>Click "Run Full Analysis"</li>
              <li>Review items/blocks in each tab</li>
              <li>Check multi-block structures</li>
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}
