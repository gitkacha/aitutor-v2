import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { api, WritingType } from '@/lib/api';
import { FileText, ChevronDown, ChevronRight, Menu, X } from 'lucide-react';

export default function Sidebar() {
  const [types, setTypes] = useState<WritingType[]>([]);
  const [writingExpanded, setWritingExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    api.getTypes().then(setTypes).catch(() => {});
  }, []);

  const isActive = (slug: string) => location.pathname.includes(slug);

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-md"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 h-full transition-transform',
          'lg:relative lg:translate-x-0',
          mobileOpen ? 'fixed inset-y-0 left-0 z-40 translate-x-0' : 'fixed -translate-x-full lg:relative lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-brand-blue">Writing Coach</h1>
          <p className="text-xs text-gray-500 mt-0.5">NSW Selective Preparation</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* Dashboard link */}
          <Link
            to="/dashboard"
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
              location.pathname === '/dashboard'
                ? 'bg-brand-blue/10 text-brand-blue font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            )}
            onClick={() => setMobileOpen(false)}
          >
            <FileText size={16} />
            Dashboard
          </Link>

          {/* Writing accordion */}
          <div>
            <button
              onClick={() => setWritingExpanded(!writingExpanded)}
              className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span>Writing</span>
              {writingExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            {writingExpanded && (
              <div className="ml-2 mt-1 space-y-0.5">
                {types.map((type) => (
                  <Link
                    key={type.slug}
                    to={`/practice/${type.slug}`}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
                      isActive(type.slug)
                        ? 'bg-brand-blue/10 text-brand-blue font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                    {type.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Admin link at bottom */}
        <div className="p-2 border-t border-gray-200">
          <Link
            to="/admin"
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors w-full',
              location.pathname === '/admin'
                ? 'bg-brand-blue/10 text-brand-blue font-medium'
                : 'text-gray-500 hover:bg-gray-100'
            )}
          >
            Admin
          </Link>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/30 z-30" onClick={() => setMobileOpen(false)} />
      )}
    </>
  );
}