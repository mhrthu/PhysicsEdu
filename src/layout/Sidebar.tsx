import { useState, useMemo } from 'react';
import { getAllSimulations } from '@/catalog/registry.ts';
import {
  EducationLevel, PhysicsDomain,
  LEVEL_COLORS, DOMAIN_COLORS, DOMAIN_ICONS,
} from '@/catalog/types.ts';

interface Props {
  currentSimId: string;
  onSelect: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const DOMAINS = Object.values(PhysicsDomain);

const LEVEL_LABEL: Record<EducationLevel, string> = {
  [EducationLevel.Elementary]: 'Intro',
  [EducationLevel.MiddleSchool]: 'Inter',
  [EducationLevel.HighSchool]: 'Standard',
  [EducationLevel.Undergraduate]: 'Advanced',
  [EducationLevel.Graduate]: 'Theory',
};

export function Sidebar({ currentSimId, onSelect, isOpen, onClose }: Props) {
  const allSims = useMemo(() => getAllSimulations(), []);
  const [search, setSearch] = useState('');

  // Expandable sections — default: expand the domain containing the active sim
  const activeDomain = useMemo(() => {
    const active = allSims.find(s => s.id === currentSimId);
    return active?.domain ?? DOMAINS[0];
  }, [allSims, currentSimId]);

  const [expanded, setExpanded] = useState<Set<PhysicsDomain>>(new Set([activeDomain]));

  const toggleDomain = (domain: PhysicsDomain) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  };

  // Group sims by domain, filtered by search
  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const groups = new Map<PhysicsDomain, typeof allSims>();
    for (const sim of allSims) {
      if (q && !sim.title.toLowerCase().includes(q) && !sim.tags.some(t => t.toLowerCase().includes(q))) continue;
      const list = groups.get(sim.domain) ?? [];
      list.push(sim);
      groups.set(sim.domain, list);
    }
    return groups;
  }, [allSims, search]);

  // When searching, auto-expand domains with matches
  const isExpanded = (domain: PhysicsDomain) => {
    if (search) return grouped.has(domain);
    return expanded.has(domain);
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed lg:static z-40 top-0 left-0 h-full flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ width: 272, background: '#0c0c0e', borderRight: '1px solid rgba(255,255,255,0.07)' }}
      >
        {/* Header */}
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
              >
                ⚛
              </div>
              <span className="text-[15px] font-semibold" style={{ color: '#f1f5f9', letterSpacing: '-0.02em' }}>
                PhysicsEdu
              </span>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)' }}
            >
              ✕
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.25)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" strokeWidth="2" />
              <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search all demos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl outline-none"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#e2e8f0',
              }}
            />
          </div>
        </div>

        {/* Domain accordion list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {DOMAINS.map(domain => {
            const sims = grouped.get(domain);
            const totalCount = allSims.filter(s => s.domain === domain).length;
            const open = isExpanded(domain);
            const color = DOMAIN_COLORS[domain];
            const hasResults = sims && sims.length > 0;

            if (search && !hasResults) return null;

            return (
              <div key={domain} className="mb-1">
                {/* Domain header — clickable to expand/collapse */}
                <button
                  onClick={() => toggleDomain(domain)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl transition-colors text-left group"
                  style={{
                    background: open ? 'rgba(255,255,255,0.04)' : 'transparent',
                  }}
                >
                  {/* Chevron */}
                  <svg
                    className="w-3 h-3 flex-shrink-0 transition-transform duration-200"
                    style={{
                      color: 'rgba(255,255,255,0.3)',
                      transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                    }}
                    fill="currentColor" viewBox="0 0 20 20"
                  >
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>

                  {/* Domain icon */}
                  <span className="text-sm leading-none">{DOMAIN_ICONS[domain]}</span>

                  {/* Domain name */}
                  <span
                    className="text-xs font-semibold uppercase tracking-wider flex-1"
                    style={{ color: open ? color : 'rgba(255,255,255,0.45)' }}
                  >
                    {domain}
                  </span>

                  {/* Count */}
                  <span
                    className="text-[10px] font-medium tabular-nums"
                    style={{ color: 'rgba(255,255,255,0.2)' }}
                  >
                    {totalCount}
                  </span>
                </button>

                {/* Expanded sim list */}
                {open && hasResults && (
                  <div className="ml-4 mt-0.5 mb-2">
                    {sims!.map(sim => {
                      const isActive = currentSimId === sim.id;
                      const levelColor = LEVEL_COLORS[sim.level];
                      return (
                        <button
                          key={sim.id}
                          onClick={() => { onSelect(sim.id); onClose(); }}
                          className="w-full text-left px-3 py-2 rounded-lg transition-colors relative flex items-center gap-2.5"
                          style={{ background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent' }}
                        >
                          {/* Difficulty dot */}
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            title={sim.level}
                            style={{ background: levelColor, opacity: isActive ? 1 : 0.5 }}
                          />
                          {/* Sim title */}
                          <span
                            className="text-[13px] truncate flex-1"
                            style={{
                              color: isActive ? '#c7d2fe' : 'rgba(255,255,255,0.55)',
                              fontWeight: isActive ? 500 : 400,
                            }}
                          >
                            {sim.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {search && grouped.size === 0 && (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>No results</p>
            </div>
          )}
        </div>

        {/* Difficulty legend */}
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          {(Object.entries(LEVEL_COLORS) as [EducationLevel, string][]).map(([level, color]) => (
            <div key={level} className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
              <span className="text-[9px] font-medium" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {LEVEL_LABEL[level]}
              </span>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
