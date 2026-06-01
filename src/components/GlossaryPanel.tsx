import React, { useState, useEffect } from 'react';
import { glossaryManager } from '../core/glossary/manager';

export default function GlossaryPanel() {
  const [sample, setSample] = useState('');
  const [output, setOutput] = useState('');

  useEffect(() => {
    setSample(
      'Người này tiến hành tu luyện, rốt cuộc sẽ hóa thành một truyền kỳ.',
    );
  }, []);

  const apply = () => {
    const out = glossaryManager.applyGlossary(sample, { style: 'xianxia' });
    setOutput(out);
  };

  return (
    <div className="p-4 glass-card rounded-2xl shadow">
      <h2 className="text-lg font-semibold">Glossary Demo</h2>
      <textarea
        className="w-full h-24 p-2 mt-2 bg-white/5"
        value={sample}
        onChange={(e) => setSample(e.target.value)}
      />
      <div className="mt-2 flex gap-2">
        <button className="px-3 py-2 rounded bg-indigo-600" onClick={apply}>
          Apply Glossary
        </button>
      </div>
      <div className="mt-3 p-2 bg-white/3 rounded">{output}</div>
    </div>
  );
}
