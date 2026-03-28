import { useState, useCallback } from 'react';
import { Sidebar } from './Sidebar.tsx';
import { SimulationView } from './SimulationView.tsx';
import { getSimulationIds } from '@/catalog/registry.ts';

export function AppLayout() {
  const [simId, setSimId] = useState(() => {
    const ids = getSimulationIds();
    return ids[0] ?? 'projectile-motion';
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSelect = useCallback((id: string) => setSimId(id), []);

  return (
    <div className="h-screen w-screen flex overflow-hidden" style={{ background: '#09090b' }}>
      <Sidebar
        currentSimId={simId}
        onSelect={handleSelect}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div
          className="lg:hidden flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(12,12,14,0.95)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
          >
            ☰
          </button>
          <span className="text-sm font-semibold" style={{ color: '#fafafa' }}>PhysicsEdu</span>
        </div>
        <SimulationView key={simId} simId={simId} />
      </div>
    </div>
  );
}
