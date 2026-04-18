import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  Search, X, Loader2, Heart, BookmarkPlus, Plus,
  Star, MoreHorizontal, ChevronDown,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/ui/Modal';

// ── Constants ─────────────────────────────────────────────────────────────────

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];

const FILTER_PILLS = [
  { id: 'all',             label: 'All' },
  { id: 'recipes',         label: 'Recipes' },
  { id: 'templates',       label: 'Templates' },
  { id: 'High Protein',    label: 'High Protein' },
  { id: 'Vegan',           label: 'Vegan' },
  { id: 'Vegetarian',      label: 'Vegetarian' },
  { id: 'Quick',           label: 'Quick' },
  { id: 'Meal Prep',       label: 'Meal Prep' },
  { id: 'Budget Friendly', label: 'Budget Friendly' },
  { id: 'Keto',            label: 'Keto' },
  { id: 'Gluten Free',     label: 'Gluten Free' },
  { id: 'Low Carb',        label: 'Low Carb' },
];

const SORT_OPTIONS = [
  { id: 'popular', label: 'Most popular' },
  { id: 'liked',   label: 'Most liked' },
  { id: 'newest',  label: 'Newest' },
];

const REPORT_REASONS = [
  'Spam or irrelevant',
  'Misleading nutrition info',
  'Inappropriate content',
  'Duplicate',
  'Other',
];

const AVATAR_COLORS = [
  'bg-purple-500', 'bg-blue-500', 'bg-green-500',
  'bg-pink-500', 'bg-orange-500', 'bg-teal-500', 'bg-red-500', 'bg-indigo-500',
];

function avatarColor(name = '') {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

// ── Community card ────────────────────────────────────────────────────────────

function CommunityCard({ item, onCopy, onAddToLog, onReport, featured }) {
  const [mealOpen,   setMealOpen]   = useState(false);
  const [liked,      setLiked]      = useState(item.likedByMe);
  const [likeCount,  setLikeCount]  = useState(item.likes);
  const [copying,    setCopying]    = useState(false);
  const [adding,     setAdding]     = useState(false);
  const toast = useToast();

  const isRecipe  = item._type === 'recipe';
  const emoji     = isRecipe ? '🍳' : '📋';
  const itemCount = isRecipe ? (item.ingredients?.length || 0) : (item.foods?.length || 0);
  const svgs      = Math.max(1, item.servings || 1);
  const calPerSvg = Math.round(isRecipe ? item.totalCalories / svgs : item.totalCalories);
  const pPerSvg   = Math.round(isRecipe ? item.totalProtein  / svgs : item.totalProtein);
  const cPerSvg   = Math.round(isRecipe ? item.totalCarbs    / svgs : item.totalCarbs);
  const fPerSvg   = Math.round(isRecipe ? item.totalFat      / svgs : item.totalFat);
  const initial   = (item.createdByName || '?')[0].toUpperCase();

  const handleLike = async () => {
    const url = `/api/community/${isRecipe ? 'recipes' : 'templates'}/${item.id}/like`;
    try {
      const { data } = await axios.post(url);
      setLiked(data.liked);
      setLikeCount(data.likes);
    } catch {
      toast.error('Could not update like');
    }
  };

  const handleCopy = async () => {
    setCopying(true);
    try {
      await onCopy(item);
    } finally {
      setCopying(false);
    }
  };

  const handleAddToLog = async (meal) => {
    setAdding(true);
    setMealOpen(false);
    try {
      await onAddToLog(item, meal);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className={`bg-white border rounded-2xl p-4 shadow-sm ${featured ? 'border-amber-200' : 'border-gray-100'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${featured ? 'bg-amber-50' : 'bg-primary-light'}`}>
            {emoji}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {featured && <Star size={11} className="text-amber-400 fill-amber-400 flex-shrink-0" />}
              <p className="font-semibold text-sm text-gray-900 truncate">{item.name}</p>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <div className={`w-3.5 h-3.5 rounded-full ${avatarColor(item.createdByName)} flex items-center justify-center flex-shrink-0`}>
                <span className="text-[7px] text-white font-bold">{initial}</span>
              </div>
              <p className="text-xs text-gray-400 truncate">{item.createdByName || 'Anonymous'}</p>
              <span className="text-xs text-gray-300 mx-0.5">·</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                isRecipe ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
              }`}>
                {isRecipe ? 'Recipe' : 'Template'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => onReport(item)}
          className="p-1.5 text-gray-300 hover:text-gray-500 flex-shrink-0"
          aria-label="Report"
        >
          <MoreHorizontal size={15} />
        </button>
      </div>

      {/* Description */}
      {item.description && (
        <p className="text-xs text-gray-500 mb-2 line-clamp-2">{item.description}</p>
      )}

      {/* Tags */}
      {item.tags?.length > 0 && (
        <div className="flex gap-1 mb-2.5 flex-wrap">
          {item.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="text-[10px] bg-primary-light text-primary px-2 py-0.5 rounded-full font-medium">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Macros */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-bold text-primary">{calPerSvg} kcal</span>
        {isRecipe && svgs > 1 && <span className="text-xs text-gray-400">/ serving</span>}
        <div className="flex gap-1 ml-auto">
          {[{ l: 'P', v: pPerSvg }, { l: 'C', v: cPerSvg }, { l: 'F', v: fPerSvg }].map((m) => (
            <span key={m.l} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
              {m.l}{m.v}g
            </span>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center text-xs text-gray-400 mb-3 gap-3">
        <span>{itemCount} {isRecipe ? 'ingredient' : 'food'}{itemCount !== 1 ? 's' : ''}</span>
        <span>·</span>
        <span>Used by {item.usageCount} {item.usageCount === 1 ? 'person' : 'people'}</span>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2">
        {/* Like */}
        <button
          onClick={handleLike}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all flex-shrink-0 ${
            liked
              ? 'bg-red-50 text-red-500 border-red-200'
              : 'bg-white text-gray-400 border-gray-200 hover:border-red-200 hover:text-red-400'
          }`}
        >
          <Heart size={11} className={liked ? 'fill-red-500' : ''} />
          {likeCount}
        </button>

        {/* Save to library */}
        <button
          onClick={handleCopy}
          disabled={copying}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-xs font-semibold border-2 border-gray-200 text-gray-600 hover:border-primary hover:text-primary transition-all disabled:opacity-60"
        >
          {copying
            ? <Loader2 size={11} className="animate-spin" />
            : <BookmarkPlus size={11} />}
          Save
        </button>

        {/* Add to log */}
        {!mealOpen ? (
          <button
            onClick={() => setMealOpen(true)}
            disabled={adding}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            {adding ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            Add to Log
          </button>
        ) : (
          <div className="flex-1 flex gap-1">
            {MEALS.map((m) => (
              <button
                key={m}
                onClick={() => handleAddToLog(m)}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold border-2 border-primary bg-primary-light text-primary hover:bg-primary hover:text-white transition-all"
              >
                {m[0].toUpperCase() + m.slice(1, 3)}
              </button>
            ))}
            <button
              onClick={() => setMealOpen(false)}
              className="w-7 flex-shrink-0 py-1.5 rounded-lg text-[10px] border border-gray-200 text-gray-400"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Featured card (compact horizontal scroll) ─────────────────────────────────

function FeaturedCard({ item, onCopy, onAddToLog }) {
  const [copying, setCopying] = useState(false);
  const isRecipe  = item._type === 'recipe';
  const svgs      = Math.max(1, item.servings || 1);
  const calPerSvg = Math.round(isRecipe ? item.totalCalories / svgs : item.totalCalories);
  const toast     = useToast();

  const handleCopy = async () => {
    setCopying(true);
    try { await onCopy(item); }
    finally { setCopying(false); }
  };

  return (
    <div className="w-44 flex-shrink-0 bg-white border border-amber-100 rounded-2xl p-3.5 shadow-sm relative">
      <div className="absolute top-2.5 right-2.5">
        <Star size={12} className="text-amber-400 fill-amber-400" />
      </div>
      <div className="text-2xl mb-2">{isRecipe ? '🍳' : '📋'}</div>
      <p className="font-semibold text-sm text-gray-900 line-clamp-2 leading-tight mb-1 pr-4">{item.name}</p>
      <p className="text-xs text-gray-400 mb-1.5 truncate">by {item.createdByName || 'Anonymous'}</p>
      <p className="text-base font-bold text-primary mb-0.5">{calPerSvg} kcal</p>
      <p className="text-[10px] text-gray-400 mb-3">{item.usageCount} uses</p>
      <button
        onClick={handleCopy}
        disabled={copying}
        className="w-full py-1.5 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary-dark disabled:opacity-60 transition-colors"
      >
        {copying ? <Loader2 size={11} className="animate-spin mx-auto" /> : 'Save'}
      </button>
    </div>
  );
}

// ── Report modal ──────────────────────────────────────────────────────────────

function ReportModal({ item, onClose }) {
  const [reason,   setReason]   = useState('');
  const [sending,  setSending]  = useState(false);
  const toast = useToast();

  if (!item) return null;

  const handleSubmit = async () => {
    if (!reason) { toast.error('Select a reason'); return; }
    setSending(true);
    try {
      await axios.post('/api/community/report', {
        contentType: item._type,
        contentId:   item.id,
        reason,
      });
      toast.success('Report submitted — thank you');
      onClose();
    } catch {
      toast.error('Failed to submit report');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Report Content">
      <div className="p-5 flex flex-col gap-4">
        <p className="text-sm text-gray-600">
          Reporting: <span className="font-semibold">{item.name}</span>
        </p>
        <div className="flex flex-col gap-2">
          {REPORT_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`text-left px-4 py-3 rounded-xl text-sm border-2 transition-all ${
                reason === r
                  ? 'border-primary bg-primary-light text-primary font-semibold'
                  : 'border-gray-100 text-gray-700 hover:border-gray-200'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <button
          onClick={handleSubmit}
          disabled={!reason || sending}
          className="w-full py-3 rounded-2xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 disabled:opacity-60 transition-colors"
        >
          {sending ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Submit Report'}
        </button>
      </div>
    </Modal>
  );
}

// ── Main CommunityLibrary component ───────────────────────────────────────────

export default function CommunityLibrary({ onLogAdded }) {
  const [query,        setQuery]        = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [sort,         setSort]         = useState('popular');
  const [sortOpen,     setSortOpen]     = useState(false);
  const [featured,     setFeatured]     = useState([]);
  const [items,        setItems]        = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [hasMore,      setHasMore]      = useState(true);
  const [offset,       setOffset]       = useState(0);
  const [reportTarget, setReportTarget] = useState(null);
  const toast = useToast();
  const LIMIT = 20;

  // ── Fetch featured (only once on mount) ──────────────────────────────────
  useEffect(() => {
    axios.get('/api/community/featured')
      .then(({ data }) => setFeatured(data))
      .catch(() => {});
  }, []);

  // ── Fetch community items ─────────────────────────────────────────────────
  const fetchItems = useCallback(async (q, filter, s, off, append = false) => {
    setLoading(true);
    try {
      const typeFilter = filter === 'templates' ? 'templates' : filter === 'recipes' ? 'recipes' : null;
      const tagFilter  = !typeFilter && filter !== 'all' ? filter : '';

      const params = new URLSearchParams({
        search: q,
        tag:    tagFilter,
        sort:   s,
        limit:  String(LIMIT),
        offset: String(off),
      });

      let results = [];

      if (typeFilter === 'recipes') {
        const { data } = await axios.get(`/api/community/recipes?${params}`);
        results = data;
      } else if (typeFilter === 'templates') {
        const { data } = await axios.get(`/api/community/templates?${params}`);
        results = data;
      } else {
        // Fetch both and interleave by sort field
        const [rRes, tRes] = await Promise.allSettled([
          axios.get(`/api/community/recipes?${params}`),
          axios.get(`/api/community/templates?${params}`),
        ]);
        const recipes   = rRes.status === 'fulfilled' ? rRes.value.data : [];
        const templates = tRes.status === 'fulfilled' ? tRes.value.data : [];

        const sortKey = s === 'liked' ? 'likes' : s === 'newest' ? 'createdAt' : 'usageCount';
        results = [...recipes, ...templates].sort((a, b) => {
          if (sortKey === 'createdAt') return new Date(b.createdAt) - new Date(a.createdAt);
          return (b[sortKey] || 0) - (a[sortKey] || 0);
        }).slice(0, LIMIT);
      }

      setItems((prev) => append ? [...prev, ...results] : results);
      setHasMore(results.length === LIMIT);
    } catch {
      if (!append) setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced re-fetch when query/filter/sort changes
  const debounceRef = useRef(null);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setOffset(0);
      fetchItems(query, activeFilter, sort, 0, false);
    }, query ? 300 : 0);
    return () => clearTimeout(debounceRef.current);
  }, [query, activeFilter, sort, fetchItems]);

  const loadMore = () => {
    const newOffset = offset + LIMIT;
    setOffset(newOffset);
    fetchItems(query, activeFilter, sort, newOffset, true);
  };

  // ── Add to log ────────────────────────────────────────────────────────────
  const handleAddToLog = async (item, meal) => {
    const isRecipe = item._type === 'recipe';
    let added = 0;
    const entries = isRecipe ? item.ingredients : item.foods;

    for (const entry of (entries || [])) {
      try {
        await axios.post('/api/log', {
          foodId:     entry.foodId,
          meal,
          multiplier: isRecipe
            ? entry.grams / (entry.servingSize || 100)
            : (entry.portionMultiplier || 1),
        });
        added++;
      } catch { /* skip missing foods */ }
    }

    if (added > 0) {
      // Increment usageCount (fire-and-forget, no library copy created)
      axios.post(`/api/community/${isRecipe ? 'recipes' : 'templates'}/${item.id}/use`).catch(() => {});
      toast.success(`${item.name} added to ${meal}`);
      onLogAdded?.();
    } else {
      toast.error('Could not add — foods may no longer exist in library');
    }
  };

  // ── Copy to library ───────────────────────────────────────────────────────
  const handleCopy = async (item) => {
    const isRecipe = item._type === 'recipe';
    try {
      await axios.post(`/api/community/${isRecipe ? 'recipes' : 'templates'}/${item.id}/copy`);
      toast.success(`${item.name} saved to your library!`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save');
    }
  };

  const sortLabel = SORT_OPTIONS.find((o) => o.id === sort)?.label || 'Most popular';
  const showFeatured = !query && activeFilter === 'all' && featured.length > 0;

  return (
    <div className="px-5 pt-4 pb-24">
      {/* Search */}
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search community recipes and templates…"
          className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-9 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {FILTER_PILLS.map((pill) => (
          <button
            key={pill.id}
            onClick={() => setActiveFilter(pill.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              activeFilter === pill.id
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-500 border-gray-200 hover:border-primary hover:text-primary'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Sort selector */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-400">
          {loading ? 'Loading…' : `${items.length} result${items.length !== 1 ? 's' : ''}`}
        </p>
        <div className="relative">
          <button
            onClick={() => setSortOpen((o) => !o)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 hover:border-primary hover:text-primary transition-all"
          >
            {sortLabel}
            <ChevronDown size={12} />
          </button>
          {sortOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-2xl shadow-lg z-20 min-w-[150px] overflow-hidden">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => { setSort(opt.id); setSortOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-primary-light ${
                    sort === opt.id ? 'text-primary font-semibold' : 'text-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Featured section ── */}
      {showFeatured && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Star size={14} className="text-amber-400 fill-amber-400" />
            <p className="text-sm font-semibold text-gray-800">Featured this week</p>
          </div>
          <div
            className="flex gap-3 overflow-x-auto pb-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {featured.map((item) => (
              <FeaturedCard
                key={`${item._type}-${item.id}`}
                item={item}
                onCopy={handleCopy}
                onAddToLog={handleAddToLog}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Community items ── */}
      {loading && items.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl block mb-3">🌐</span>
          <p className="text-base font-semibold text-gray-700 mb-1">Nothing here yet</p>
          <p className="text-sm text-gray-400">
            {query
              ? `No results for "${query}". Try a different search.`
              : 'Be the first to share a recipe or template with the community!'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <CommunityCard
              key={`${item._type}-${item.id}`}
              item={item}
              onCopy={handleCopy}
              onAddToLog={handleAddToLog}
              onReport={setReportTarget}
            />
          ))}

          {/* Load more */}
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loading}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-400 font-medium hover:border-primary hover:text-primary transition-all disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Load more'}
            </button>
          )}
        </div>
      )}

      {/* Overlay to close sort dropdown */}
      {sortOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
      )}

      {/* Report modal */}
      {reportTarget && (
        <ReportModal item={reportTarget} onClose={() => setReportTarget(null)} />
      )}
    </div>
  );
}
