import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Store,
  Calculator,
  Printer,
  Users,
  Server,
  ChevronRight,
  ChevronDown,
  Save,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import {
  searchSettingsNav,
  type SettingsCategory,
  type SettingsCategoryId,
  type SettingsSearchHit,
} from './settingsNavigation';

const CATEGORY_ICONS: Record<SettingsCategoryId, LucideIcon> = {
  general: Building2,
  operations: Store,
  accountingFinance: Calculator,
  documentsPrinting: Printer,
  usersAccess: Users,
  systemData: Server,
};

interface SettingsLayoutProps {
  categories: SettingsCategory[];
  activeCategoryId: SettingsCategoryId;
  activeItemId: string;
  onSelect: (categoryId: SettingsCategoryId, itemId: string) => void;
  categoryDescription?: string;
  hasUnsavedChanges?: boolean;
  onSave?: () => void;
  children: React.ReactNode;
}

export function SettingsLayout({
  categories,
  activeCategoryId,
  activeItemId,
  onSelect,
  categoryDescription,
  hasUnsavedChanges,
  onSave,
  children,
}: SettingsLayoutProps) {
  const activeCategory = categories.find((c) => c.id === activeCategoryId);
  const activeItem = activeCategory?.items.find((i) => i.id === activeItemId);
  const [expandedCategoryId, setExpandedCategoryId] = useState<SettingsCategoryId | null>(activeCategoryId);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const searchHits = useMemo(
    () => searchSettingsNav(categories, searchQuery),
    [categories, searchQuery],
  );

  useEffect(() => {
    setExpandedCategoryId(activeCategoryId);
  }, [activeCategoryId]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!searchWrapRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const toggleCategory = (categoryId: SettingsCategoryId) => {
    setExpandedCategoryId((prev) => (prev === categoryId ? null : categoryId));
  };

  const selectSearchHit = (hit: SettingsSearchHit) => {
    onSelect(hit.categoryId, hit.itemId);
    setExpandedCategoryId(hit.categoryId);
    setSearchQuery('');
    setSearchOpen(false);
    setHighlightIndex(0);
  };

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setSearchQuery('');
      setSearchOpen(false);
      setHighlightIndex(0);
      return;
    }
    if (!searchHits.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSearchOpen(true);
      setHighlightIndex((prev) => (prev + 1) % searchHits.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSearchOpen(true);
      setHighlightIndex((prev) => (prev - 1 + searchHits.length) % searchHits.length);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const hit = searchHits[highlightIndex] ?? searchHits[0];
      if (hit) selectSearchHit(hit);
    }
  };

  const showResults = searchOpen && searchQuery.trim().length >= 1 && searchHits.length > 0;

  return (
    <div className="min-h-screen bg-background text-foreground animate-in fade-in duration-500">
      <div className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-foreground">Settings</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {activeItem?.label ?? 'Configure your ERP defaults and preferences'}
              </p>
              {categoryDescription ? (
                <p className="text-xs text-muted-foreground mt-1">{categoryDescription}</p>
              ) : null}
            </div>
            <div className="flex items-start gap-2 shrink-0 w-full sm:w-auto">
              <div ref={searchWrapRef} className="relative flex-1 sm:w-72 min-w-0">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={onSearchKeyDown}
                  placeholder="Search settings (e.g. packing)…"
                  aria-label="Search settings"
                  aria-autocomplete="list"
                  aria-controls={listboxId}
                  aria-expanded={showResults}
                  className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                {showResults ? (
                  <ul
                    id={listboxId}
                    role="listbox"
                    className="absolute z-40 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg"
                  >
                    {searchHits.map((hit, index) => {
                      const active = index === highlightIndex;
                      return (
                        <li key={`${hit.categoryId}-${hit.itemId}`} role="option" aria-selected={active}>
                          <button
                            type="button"
                            onMouseEnter={() => setHighlightIndex(index)}
                            onClick={() => selectSearchHit(hit)}
                            className={cn(
                              'w-full px-3 py-2 text-left transition-colors',
                              active ? 'bg-primary/15 text-foreground' : 'hover:bg-muted/80',
                            )}
                          >
                            <span className="block text-sm font-medium truncate">{hit.label}</span>
                            <span className="block text-xs text-muted-foreground truncate">
                              {hit.matchHint
                                ? `${hit.categoryLabel} · ${hit.matchHint}`
                                : hit.categoryLabel}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
              {hasUnsavedChanges && onSave ? (
                <Button
                  onClick={onSave}
                  className="bg-green-600 hover:bg-green-500 text-foreground gap-2 shadow-lg shrink-0"
                >
                  <Save size={16} /> Save Changes
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="flex flex-col md:flex-row gap-6 min-h-[calc(100vh-8rem)]">
          <aside className="md:w-60 shrink-0 md:border-r md:border-border md:pr-4">
            <nav className="space-y-1" aria-label="Settings navigation">
              {categories.map((category) => {
                const Icon = CATEGORY_ICONS[category.id];
                const isActiveCategory = category.id === activeCategoryId;
                const isExpanded = expandedCategoryId === category.id;
                return (
                  <div key={category.id} className="rounded-lg border border-transparent">
                    <button
                      type="button"
                      onClick={() => toggleCategory(category.id)}
                      aria-expanded={isExpanded}
                      className={cn(
                        'w-full flex items-center justify-between gap-2 px-2 py-2.5 rounded-lg text-left transition-colors',
                        isActiveCategory
                          ? 'bg-muted text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                      )}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Icon size={16} className="shrink-0" />
                        <span className="text-xs font-semibold uppercase tracking-wide truncate">
                          {category.label}
                        </span>
                      </span>
                      <ChevronDown
                        size={16}
                        className={cn(
                          'shrink-0 transition-transform duration-200',
                          isExpanded ? 'rotate-0' : '-rotate-90',
                        )}
                      />
                    </button>
                    {isExpanded ? (
                      <ul className="mt-0.5 mb-2 ml-2 pl-2 border-l border-border space-y-0.5">
                        {category.items.map((item) => {
                          const selected = activeCategoryId === category.id && activeItemId === item.id;
                          return (
                            <li key={item.id}>
                              <button
                                type="button"
                                onClick={() => onSelect(category.id, item.id)}
                                className={cn(
                                  'w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                                  selected
                                    ? 'bg-primary/20 text-foreground border border-primary/40'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/80 border border-transparent',
                                )}
                              >
                                <span className="truncate">{item.label}</span>
                                {selected ? <ChevronRight size={14} className="shrink-0 text-primary" /> : null}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </nav>
          </aside>

          <main className="flex-1 min-w-0">
            <div className="bg-card border border-border rounded-xl p-4 md:p-6 space-y-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
