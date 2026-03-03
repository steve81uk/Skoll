import React, { useState, useEffect } from 'react';

interface ModuleStatus {
  name: string;
  restarts: number;
  lastSync: string;
}

export const HealthDashboard: React.FC = () => {
  const STORAGE_KEY = 'skoll-health-dashboard-v1';
  // Initial module states tracking the Sköll-Track sub-systems [cite: 2025-12-11]
  const [modules, setModules] = useState<ModuleStatus[]>(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) as ModuleStatus[];
    }

    return [
      { name: 'Observa-Scene', restarts: 0, lastSync: 'NOMINAL' },
      { name: 'Data-Analytics', restarts: 0, lastSync: 'ACTIVE' },
      { name: 'Chronos-Rail', restarts: 0, lastSync: 'SYNCED' },
      { name: 'JPL-Engine', restarts: 0, lastSync: 'POLLING' }
    ];
  });

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(modules));
  }, [modules]);

  useEffect(() => {
    const onReinit = (event: Event) => {
      const customEvent = event as CustomEvent<{ moduleName?: string }>;
      const moduleName = customEvent.detail?.moduleName ?? 'Observa-Scene';

      setModules((prev) => {
        const hasModule = prev.some((module) => module.name === moduleName);
        const next = hasModule
          ? prev.map((module) =>
              module.name === moduleName
                ? {
                    ...module,
                    restarts: module.restarts + 1,
                    lastSync: `REINIT ${new Date().toLocaleTimeString()}`,
                  }
                : module,
            )
          : [
              ...prev,
              {
                name: moduleName,
                restarts: 1,
                lastSync: `REINIT ${new Date().toLocaleTimeString()}`,
              },
            ];

        return next;
      });
    };

    window.addEventListener('system:reinit', onReinit);
    return () => window.removeEventListener('system:reinit', onReinit);
  }, []);

  return (
    <div className="space-y-4 font-mono pointer-events-auto">
          <div className="grid grid-cols-2 gap-2">
              {modules.map((mod) => (
                  <div key={mod.name} className="p-3 bg-black/40 border border-white/5 rounded-md">
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">
                          {mod.name}
                      </div>
                      <div className="flex justify-between items-end">
                          <span className={`text-xs ${mod.restarts > 0 ? 'text-yellow-500' : 'text-cyan-400'}`}>
                              RESTARTS: {mod.restarts}
                          </span>
                          <span className="text-[10px] text-white/40">
                              {mod.lastSync}
                          </span>
                      </div>
                      {/* Visual health bar indicating sub-system stability [cite: 2025-12-11] */}
                      <div className="mt-2 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div
                              className={`h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-1000`}
                              style={{ inlineSize: mod.restarts > 0 ? '70%' : '100%' }}
                        ></div>
                    </div>
                </div>
            ))}
        </div>
        <div className="p-3 bg-cyan-900/20 border border-cyan-500/30 rounded-md">
            <h3 className="text-cyan-300 text-[11px] uppercase mb-2">Neural Warp Core</h3>
            <div className="text-white text-lg font-bold">STABLE</div>
            <p className="text-[9px] text-slate-400 mt-1 leading-tight">
                All Slates reporting J2000 equilibrium. Bridge integrity is at 99.8%. [cite: 2025-12-11]
            </p>
        </div>
    </div>
  );
};