import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Search, X, Loader2, Database, Users } from 'lucide-react';
import FoodDetailModal from './FoodDetailModal';
import RecipeBuilder from './RecipeBuilder';
import CommunityLibrary from './CommunityLibrary';
import HelpModal from '../../components/ui/HelpModal';
import { useToast } from '../../context/ToastContext';

const LIBRARY_HELP = `Browse your personal food library and the USDA nutrition database containing thousands of foods. Search by name to find any food, tap it to see full nutrition facts, or add it directly to today's log. You can also browse by category using the filter buttons. Recipes you build will appear on the Recipes tab.`;

const CATEGORY_EMOJI = {
  Proteins: '🥩', Dairy: '🥛', Legumes: '🫘', Grains: '🌾',
  Vegetables: '🥦', Fruits: '🍎', 'Nuts & Seeds': '🥜',
  'Oils & Fats': '🫒', 'Dairy Alternatives': '🌱', Other: '🍫',
  Supplements: '💊', Beverages: '☕', Snacks: '🍿', 'Fast Food': '🍔',
  Restaurants: '🏪', 'Scanned Products': '🏷️',
};

const RESTAURANT_EMOJI = {
  "McDonald's":   '🍔',
  "Chipotle":     '🌯',
  "Subway":       '🥖',
  "Starbucks":    '☕',
  "Chick-fil-A":  '🐔',
  "Panera Bread": '🥣',
  "Taco Bell":    '🌮',
  "Pizza Hut":    '🍕',
};

const BROWSE_PAGE_SIZE = 25;

// ── Shared food row card ──────────────────────────────────────────────────────

function FoodCard({ food, onClick, importing }) {
  return (
    <button
      onClick={onClick}
      disabled={importing}
      className="w-full flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-4 py-3.5 text-left hover:border-primary hover:bg-primary-light transition-all disabled:opacity-60"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 bg-primary-light rounded-xl flex items-center justify-center text-xl flex-shrink-0">
          {CATEGORY_EMOJI[food.category] || '🍽️'}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-medium text-sm text-gray-900 truncate">{food.name}</p>
            {food._usda && (
              <span className="shrink-0 text-[10px] font-semibold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-md leading-none">
                USDA
              </span>
            )}
            {food.source === 'barcode_scan' && (
              <span className="shrink-0 text-[10px] font-semibold bg-green-100 text-green-600 px-1.5 py-0.5 rounded-md leading-none flex items-center gap-0.5">
                <Users size={9} />
                Community
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 truncate">
            {food.brand ? `${food.brand} · ` : ''}{food.category}
            {food.servingSize ? ` · ${food.servingSize}${food.servingUnit}` : ''}
            {food.source === 'barcode_scan' && food.scanCount > 0
              ? ` · ${food.scanCount} scan${food.scanCount !== 1 ? 's' : ''}`
              : ''}
          </p>
          {food.source === 'barcode_scan' && food.firstScannedBy && (
            <p className="text-[10px] text-green-500 truncate">
              First scanned by {food.firstScannedBy}
            </p>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0 ml-2">
        {importing ? (
          <Loader2 size={16} className="animate-spin text-primary" />
        ) : food.calories != null ? (
          <>
            <p className="text-sm font-bold text-primary">{Math.round(food.calories)} kcal</p>
            <p className="text-xs text-gray-400">P{Math.round(food.protein ?? 0)}g</p>
          </>
        ) : (
          <p className="text-xs text-gray-400 italic">tap to view</p>
        )}
      </div>
    </button>
  );
}

// ── Main Library page ─────────────────────────────────────────────────────────

export default function Library() {
  const [activeTab, setActiveTab] = useState('foods'); // 'foods' | 'recipes' | 'community'

  // Local DB state
  const [foods, setFoods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState('All');

  // Search state
  const [query, setQuery] = useState('');
  const [usdaResults, setUsdaResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Browse (infinite scroll) state
  const [browseItems, setBrowseItems] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseHasMore, setBrowseHasMore] = useState(true);

  // Import / modal state
  const [importingFdcId, setImportingFdcId] = useState(null);
  const [selected, setSelected] = useState(null);

  // Refs for browse scroll (avoid stale closures in IntersectionObserver)
  const browsePageRef = useRef(1);
  const browseLoadingRef = useRef(false);
  const browseHasMoreRef = useRef(true);
  const sentinelRef = useRef(null);
  const searchTimer = useRef(null);
  const toast = useToast();

  // ── Load local foods on mount ──
  useEffect(() => {
    Promise.all([
      axios.get('/api/foods'),
      axios.get('/api/foods/categories'),
    ]).then(([foodRes, catRes]) => {
      setFoods(foodRes.data);
      setCategories(['All', ...catRes.data]);
    }).catch(() => toast.error('Failed to load foods'));
  }, []);

  // ── Debounced USDA search ──
  useEffect(() => {
    if (!query.trim()) {
      setUsdaResults([]);
      setSearchLoading(false);
      return;
    }
    clearTimeout(searchTimer.current);
    setSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await axios.get(`/api/usda/search?q=${encodeURIComponent(query)}`);
        setUsdaResults(data.map((f) => ({ ...f, _usda: true })));
      } catch {
        setUsdaResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(searchTimer.current);
  }, [query]);

  // ── Browse: load next page (stable callback via refs) ──
  const loadNextBrowse = useCallback(async () => {
    if (browseLoadingRef.current || !browseHasMoreRef.current) return;
    browseLoadingRef.current = true;
    setBrowseLoading(true);
    const page = browsePageRef.current;
    try {
      const { data } = await axios.get(`/api/usda/browse?page=${page}`);
      const hasMore = data.length === BROWSE_PAGE_SIZE;
      if (!hasMore) browseHasMoreRef.current = false;
      setBrowseHasMore(hasMore);
      setBrowseItems((prev) => (page === 1 ? data : [...prev, ...data]));
      browsePageRef.current = page + 1;
    } catch {
      browseHasMoreRef.current = false;
      setBrowseHasMore(false);
    } finally {
      browseLoadingRef.current = false;
      setBrowseLoading(false);
    }
  }, []);

  // ── IntersectionObserver: re-attach whenever visibility conditions change ──
  // Browse section only renders when !query && selectedCat === 'All', so we
  // depend on both to correctly re-attach after the sentinel re-mounts.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadNextBrowse(); },
      { rootMargin: '400px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadNextBrowse, query, selectedCat]);

  // ── Click handler: import USDA food → open modal ──
  const handleFoodClick = async (food) => {
    if (food._usda) {
      setImportingFdcId(food.fdcId);
      try {
        const { data } = await axios.post('/api/usda/import', { fdcId: food.fdcId });
        // Merge into local library so it shows permanently after import
        setFoods((prev) => prev.some((f) => f.id === data.id) ? prev : [data, ...prev]);
        setSelected(data);
      } catch {
        toast.error('Failed to load food details');
      } finally {
        setImportingFdcId(null);
      }
    } else {
      setSelected(food);
    }
  };

  // ── Derived lists ──
  const filteredLocal = (() => {
    const base = foods.filter((f) => {
      const matchCat = selectedCat === 'All' || f.category === selectedCat;
      const matchQ   = !query || f.name.toLowerCase().includes(query.toLowerCase());
      return matchCat && matchQ;
    });
    // Scanned products: show most-recently-scanned first
    if (selectedCat === 'Scanned Products') {
      return [...base].sort((a, b) => {
        const da = a.firstScannedAt ? new Date(a.firstScannedAt).getTime() : 0;
        const db = b.firstScannedAt ? new Date(b.firstScannedAt).getTime() : 0;
        return db - da;
      });
    }
    return base;
  })();

  // Filter USDA search results by active category chip
  const filteredUsda = usdaResults.filter(
    (f) => selectedCat === 'All' || f.category === selectedCat
  );

  // Hide browse items that have already been imported into the local library
  const browseFoods = browseItems.filter(
    (b) => !foods.some((f) => f.fdcId === b.fdcId)
  );

  // Whether to show the browse section
  const showBrowse = !query && selectedCat === 'All';

  return (
    <div className="pb-24 min-h-screen">
      {/* ── Sticky header ── */}
      <div className="bg-white sticky top-0 z-10 px-5 pt-12 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-syne font-bold text-2xl">Food Library</h1>
          <HelpModal title="Food Library" description={LIBRARY_HELP} />
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1.5 mb-3">
          {[
            { id: 'foods',     label: 'Foods'     },
            { id: 'recipes',   label: 'Recipes'   },
            { id: 'community', label: 'Community' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border-2 transition-all ${
                activeTab === tab.id
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-500 border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Foods-only controls */}
        {activeTab === 'foods' && (
          <>
            {/* Search input */}
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search library + USDA database..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-9 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {searchLoading
                    ? <Loader2 size={14} className="animate-spin" />
                    : <X size={14} />}
                </button>
              )}
            </div>

            {/* Category chips */}
            <div className="category-scroll -mx-5 px-5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCat(cat)}
                  style={{ flexShrink: 0 }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    selectedCat === cat
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {CATEGORY_EMOJI[cat] && <span>{CATEGORY_EMOJI[cat]}</span>}
                  {cat}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Recipes tab ── */}
      {activeTab === 'recipes' && <RecipeBuilder />}

      {/* ── Community tab ── */}
      {activeTab === 'community' && <CommunityLibrary />}

      {/* ── Foods tab body ── */}
      {activeTab === 'foods' && <div className="px-5 pt-4">

        {/* ── Restaurants: grouped by brand ── */}
        {selectedCat === 'Restaurants' && (() => {
          if (filteredLocal.length === 0) {
            return (
              <p className="text-center text-sm text-gray-400 py-10">
                {query ? `No restaurant items match "${query}"` : 'No restaurant items yet'}
              </p>
            );
          }
          const groups = filteredLocal.reduce((acc, f) => {
            const b = f.brand || 'Other';
            (acc[b] = acc[b] || []).push(f);
            return acc;
          }, {});
          return Object.entries(groups).map(([brand, items]) => (
            <div key={brand} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{RESTAURANT_EMOJI[brand] || '🍽️'}</span>
                <div>
                  <p className="font-syne font-bold text-sm text-gray-900">{brand}</p>
                  <p className="text-xs text-gray-400">{items.length} item{items.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {items.map((food) => (
                  <FoodCard
                    key={food.id}
                    food={food}
                    onClick={() => handleFoodClick(food)}
                    importing={false}
                  />
                ))}
              </div>
            </div>
          ));
        })()}

        {/* ── All other categories: flat list ── */}
        {selectedCat !== 'Restaurants' && filteredLocal.length > 0 && (
          <div className="mb-5">
            <p className="text-xs text-gray-400 mb-3">
              {query ? `${filteredLocal.length} in your library` : `${filteredLocal.length} foods`}
            </p>
            <div className="flex flex-col gap-2">
              {filteredLocal.map((food) => (
                <FoodCard
                  key={food.id}
                  food={food}
                  onClick={() => handleFoodClick(food)}
                  importing={false}
                />
              ))}
            </div>
          </div>
        )}

        {/* USDA search results (only while a query is active and not in Restaurants view) */}
        {selectedCat !== 'Restaurants' && query && (filteredUsda.length > 0 || searchLoading) && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Database size={13} className="text-blue-500" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                USDA Database
              </p>
              {searchLoading && <Loader2 size={12} className="animate-spin text-gray-400" />}
            </div>
            <div className="flex flex-col gap-2">
              {filteredUsda.map((food, i) => (
                <FoodCard
                  key={food.fdcId ?? i}
                  food={food}
                  onClick={() => handleFoodClick(food)}
                  importing={importingFdcId === food.fdcId}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty search state (non-restaurant categories) */}
        {selectedCat !== 'Restaurants' && query && !searchLoading && filteredLocal.length === 0 && filteredUsda.length === 0 && (
          <div className="flex flex-col items-center text-center py-12">
            <span className="text-5xl mb-3">🔍</span>
            <p className="text-base font-semibold text-gray-700 mb-1">No foods found</p>
            <p className="text-sm text-gray-400">
              No results for &ldquo;{query}&rdquo;. Try a different word or check the spelling.
            </p>
          </div>
        )}

        {/* Browse USDA Database — infinite scroll, shown when no query + All category */}
        {showBrowse && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Database size={14} className="text-blue-500" />
                <p className="text-sm font-semibold text-gray-700">Browse USDA Database</p>
              </div>
              <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                Foundation · SR Legacy
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {browseFoods.map((food, i) => (
                <FoodCard
                  key={food.fdcId ?? i}
                  food={{ ...food, _usda: true }}
                  onClick={() => handleFoodClick({ ...food, _usda: true })}
                  importing={importingFdcId === food.fdcId}
                />
              ))}
            </div>

            {/* Sentinel observed by IntersectionObserver; triggers loadNextBrowse */}
            <div ref={sentinelRef} className="py-6 flex justify-center">
              {browseLoading && <Loader2 size={20} className="animate-spin text-gray-300" />}
              {!browseHasMore && browseFoods.length > 0 && (
                <p className="text-xs text-gray-400">All USDA foods loaded</p>
              )}
            </div>
          </div>
        )}
      </div>}

      <FoodDetailModal food={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
