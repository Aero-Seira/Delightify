/**
 * LLM Debug Page - v2.1
 * 
 * 暂时禁用，v2.1 暂不支持 LLM 功能
 */

import React from 'react';

export const LLMDebug: React.FC = () => {
  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
      <h1>🤖 LLM 调试工具</h1>
      <p style={{ color: '#666', marginTop: '20px' }}>
        LLM 功能在 v2.1 中暂时不可用。
        <br />
        后续版本将重新实现。
      </p>
    </div>
  );
};

export default LLMDebug;
