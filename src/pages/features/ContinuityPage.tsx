import React from 'react';
import { Card } from '@/components/ui/card';

const ContinuityPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold mb-4">Continuity Thread</h1>
      <p className="text-sm text-slate-300 mb-6">A lightweight scaffold showing the Continuity Thread feature surface.</p>

      <Card className="p-6 alera-panel">
        <h2 className="text-lg font-medium">Overview</h2>
        <p className="mt-2 text-sm text-slate-300">The Continuity Thread links people, tasks, events and ownership across a patient journey. This page is a starting point for building that experience.</p>

        <div className="mt-6 grid grid-cols-1 gap-4">
          <div className="alera-surface-2 p-4 rounded-md">
            <p className="text-sm text-slate-200">Patient: <strong>Jane Doe</strong></p>
            <p className="text-xs text-slate-400">Active risks: 2 · Open tasks: 4 · Last update: 22m</p>
          </div>

          <div className="alera-surface-2 p-4 rounded-md">
            <p className="text-sm text-slate-200">Thread Summary</p>
            <p className="text-xs text-slate-400 mt-2">No summaries generated yet. Use the AI assistant to synthesise change history and next steps.</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ContinuityPage;
