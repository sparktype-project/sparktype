// Minimal test component to isolate SparkBlock issues
import { useState } from 'react';

export function TestSparkBlock() {
  const [text, setText] = useState('Hello from SparkBlock test');
  
  return (
    <div style={{ border: '1px solid green', padding: '20px' }}>
      <h3>SparkBlock Test Component</h3>
      <div>
        <input 
          type="text" 
          value={text} 
          onChange={(e) => setText(e.target.value)}
          style={{ width: '100%', padding: '8px' }}
        />
      </div>
      <div style={{ marginTop: '10px' }}>
        Current text: {text}
      </div>
    </div>
  );
}