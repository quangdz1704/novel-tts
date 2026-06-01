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
    <div className="surface-panel">
      <p className="panel-kicker">Translation</p>
      <h2 className="panel-title">Glossary demo</h2>
      <textarea
        className="field-input mt-3 h-24 w-full resize-none"
        value={sample}
        onChange={(e) => setSample(e.target.value)}
      />
      <div className="mt-2 flex gap-2">
        <button className="secondary-button" onClick={apply}>
          Apply Glossary
        </button>
      </div>
      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        {output || 'Glossary output will appear here.'}
      </div>
    </div>
  );
}
