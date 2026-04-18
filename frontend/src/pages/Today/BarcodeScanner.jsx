/**
 * BarcodeScanner — full barcode scanning modal with three modes:
 *   • Camera   — live camera stream via html5-qrcode
 *   • Photo    — pick/take a photo and decode the barcode from it
 *   • Manual   — type the barcode number by hand
 *
 * On a successful scan the barcode is looked up via GET /api/barcode/:code.
 * The route checks the local DB first (instant for repeat scans) and falls back
 * to Open Food Facts, saving the result permanently.
 *
 * Recent scans (last 5 food IDs) are persisted in localStorage so they survive
 * page reloads without any extra API calls.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import axios from 'axios';
import { Camera, ImageIcon, Hash, X, Loader2, AlertCircle, Clock } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

// ── Recent-scans helpers ───────────────────────────────────────────────────────

const LS_KEY   = 'nutriai_recent_scans';
const MAX_HIST = 5;

function getRecentIds() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
  catch { return []; }
}

function pushRecentId(id) {
  const ids = getRecentIds().filter(x => x !== id);
  ids.unshift(id);
  localStorage.setItem(LS_KEY, JSON.stringify(ids.slice(0, MAX_HIST)));
}

// ── Tiny emoji map for recent-scan chips ──────────────────────────────────────

const CAT_EMOJI = {
  Proteins: '🥩', Dairy: '🥛', Legumes: '🫘', Grains: '🌾',
  Vegetables: '🥦', Fruits: '🍎', 'Nuts & Seeds': '🥜',
  'Oils & Fats': '🫒', Beverages: '☕', Snacks: '🍿',
  Frozen: '❄️', 'Scanned Products': '🏷️', Other: '🍫',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function BarcodeScanner({ isOpen, onClose, onFoodFound }) {
  const toast = useToast();

  const [mode,         setMode]         = useState('camera');  // 'camera' | 'photo' | 'manual'
  const [cameraState,  setCameraState]  = useState('idle');    // 'idle' | 'starting' | 'active' | 'error'
  const [cameraError,  setCameraError]  = useState('');
  const [lookingUp,    setLookingUp]    = useState(false);
  const [lookupError,  setLookupError]  = useState('');        // '' | 'not_found' | 'photo_fail' | string
  const [manualCode,   setManualCode]   = useState('');
  const [recentFoods,  setRecentFoods]  = useState([]);

  const scannerRef   = useRef(null);   // holds Html5Qrcode instance for camera
  const fileInputRef = useRef(null);
  const scanLockRef  = useRef(false);  // prevent double-processing a single scan

  // ── Load recent scans whenever the modal opens ─────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const ids = getRecentIds();
    if (!ids.length) { setRecentFoods([]); return; }
    Promise.all(
      ids.map(id => axios.get(`/api/foods/${id}`).then(r => r.data).catch(() => null))
    ).then(foods => setRecentFoods(foods.filter(Boolean)));
  }, [isOpen]);

  // ── Camera lifecycle ───────────────────────────────────────────────────────
  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) await scannerRef.current.stop();
      } catch { /* ignore cleanup errors */ }
      scannerRef.current = null;
    }
    setCameraState('idle');
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError('');
    setCameraState('starting');
    scanLockRef.current = false;

    try {
      const scanner = new Html5Qrcode('barcode-camera-view');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 120 } },
        async (text) => {
          if (scanLockRef.current) return;
          scanLockRef.current = true;
          await stopCamera();
          await lookupBarcode(text);
        },
        () => {} // per-frame "not found" — expected, silence it
      );
      setCameraState('active');
    } catch (err) {
      setCameraState('error');
      if (/permission|denied|notallowed/i.test(err?.message ?? '')) {
        setCameraError('denied');
      } else {
        setCameraError(err?.message || 'Could not start camera');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start / stop camera when mode or isOpen changes
  useEffect(() => {
    if (!isOpen) { stopCamera(); return; }
    if (mode === 'camera') startCamera();
    else stopCamera();
    return () => { stopCamera(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode]);

  // ── Barcode lookup ─────────────────────────────────────────────────────────
  const lookupBarcode = async (code) => {
    setLookupError('');
    setLookingUp(true);
    try {
      const { data } = await axios.get(`/api/barcode/${encodeURIComponent(code)}`);
      pushRecentId(data.id);
      onFoodFound(data);
      handleClose();
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) {
        setLookupError('not_found');
      } else {
        setLookupError(err.response?.data?.error || 'Lookup failed. Please try again.');
      }
      // Allow camera to restart if needed
      if (mode === 'camera') { scanLockRef.current = false; startCamera(); }
    } finally {
      setLookingUp(false);
    }
  };

  // ── Photo upload ───────────────────────────────────────────────────────────
  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLookupError('');
    setLookingUp(true);

    try {
      // Html5Qrcode needs a real DOM element even for file scanning
      const scanner = new Html5Qrcode('barcode-file-anchor');
      const text = await scanner.scanFile(file, /* showImage */ false);
      await lookupBarcode(text);
    } catch {
      setLookupError('photo_fail');
    } finally {
      setLookingUp(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Manual entry ───────────────────────────────────────────────────────────
  const handleManual = () => {
    const code = manualCode.trim();
    if (!code) return;
    lookupBarcode(code);
  };

  // ── Close ──────────────────────────────────────────────────────────────────
  const handleClose = () => {
    stopCamera();
    setMode('camera');
    setManualCode('');
    setLookupError('');
    onClose();
  };

  if (!isOpen) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Barcode scanner"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-app bg-white rounded-t-3xl h-[90vh] flex flex-col animate-slide-up overflow-hidden">

        {/* Handle + header */}
        <div className="flex-shrink-0 pt-3 pb-0">
          <div className="flex justify-center mb-2">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>
          <div className="flex items-center justify-between px-5 pb-3 border-b border-gray-100">
            <h2 className="font-syne font-bold text-lg">Scan Barcode</h2>
            <button
              aria-label="Close scanner"
              onClick={handleClose}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex-shrink-0 flex gap-2 px-5 py-3 border-b border-gray-100">
          {[
            { id: 'camera', Icon: Camera,    label: 'Camera'     },
            { id: 'photo',  Icon: ImageIcon, label: 'From Photo' },
            { id: 'manual', Icon: Hash,      label: 'Manual'     },
          ].map(({ id, Icon, label }) => (
            <button
              key={id}
              onClick={() => { setLookupError(''); setMode(id); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                mode === id
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Icon size={15} />{label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

          {/* ── Camera mode ── */}
          {mode === 'camera' && (
            <div>
              {cameraState === 'error' ? (
                <div className="flex flex-col items-center text-center gap-3 p-6 bg-amber-50 rounded-2xl">
                  <AlertCircle size={36} className="text-amber-500" />
                  {cameraError === 'denied' ? (
                    <>
                      <p className="text-base font-semibold text-amber-800">Camera access needed</p>
                      <p className="text-sm text-amber-700 leading-relaxed">
                        Camera access is needed to scan barcodes. Please allow camera access in your browser settings, then try again.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-base font-semibold text-amber-800">Camera unavailable</p>
                      <p className="text-sm text-amber-700">{cameraError || 'Could not start the camera.'}</p>
                    </>
                  )}
                  <button
                    onClick={startCamera}
                    className="px-5 py-2.5 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition-colors"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <div>
                  {cameraState === 'starting' && (
                    <div className="flex items-center justify-center gap-2 py-4 text-gray-400">
                      <Loader2 size={18} className="animate-spin" />
                      <span className="text-sm">Starting camera…</span>
                    </div>
                  )}
                  {/* html5-qrcode mounts the video stream into this div */}
                  <div
                    id="barcode-camera-view"
                    className="rounded-2xl overflow-hidden bg-black min-h-[260px]"
                  />
                  {cameraState === 'active' && (
                    <p className="text-xs text-gray-400 text-center mt-3">
                      Point the camera at a barcode — it will scan automatically
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Photo mode ── */}
          {mode === 'photo' && (
            <div className="flex flex-col items-center text-center gap-4 p-6 bg-primary-light rounded-2xl">
              <span className="text-5xl">📸</span>
              <div>
                <p className="text-base font-semibold text-gray-800 mb-1">Scan from a photo</p>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Take a new photo of a barcode or pick one from your camera roll.
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full">
                {/* Take photo with camera */}
                <button
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.removeAttribute('multiple');
                      fileInputRef.current.setAttribute('capture', 'environment');
                      fileInputRef.current.click();
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-white font-semibold py-3.5 rounded-2xl hover:bg-primary-dark transition-colors"
                >
                  <Camera size={18} />Take Photo
                </button>
                {/* Pick from library */}
                <button
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.removeAttribute('capture');
                      fileInputRef.current.click();
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 border-2 border-primary text-primary font-semibold py-3.5 rounded-2xl hover:bg-primary-light transition-colors"
                >
                  <ImageIcon size={18} />Choose from Library
                </button>
              </div>
              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
              {/* Invisible anchor div required by html5-qrcode scanFile() */}
              <div id="barcode-file-anchor" style={{ display: 'none' }} />
            </div>
          )}

          {/* ── Manual mode ── */}
          {mode === 'manual' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-gray-500">
                Type the number shown below the barcode on the product packaging.
              </p>
              <input
                type="text"
                inputMode="numeric"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleManual()}
                placeholder="e.g. 0038000845604"
                autoFocus
                className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 text-base focus:outline-none focus:border-primary transition-colors"
              />
              <button
                onClick={handleManual}
                disabled={!manualCode.trim() || lookingUp}
                className="w-full min-h-[52px] flex items-center justify-center gap-2 bg-primary text-white font-bold rounded-2xl hover:bg-primary-dark disabled:opacity-60 transition-colors"
              >
                {lookingUp
                  ? <><Loader2 size={18} className="animate-spin" />Looking up…</>
                  : 'Look up product'}
              </button>
            </div>
          )}

          {/* ── Shared loading overlay ── */}
          {lookingUp && mode !== 'manual' && (
            <div className="flex items-center justify-center gap-3 py-4 text-gray-500">
              <Loader2 size={20} className="animate-spin text-primary" />
              <span className="text-base">Looking up product…</span>
            </div>
          )}

          {/* ── Error states ── */}
          {lookupError && (
            <div className="flex flex-col items-center text-center gap-3 p-5 bg-red-50 rounded-2xl">
              {lookupError === 'not_found' && (
                <>
                  <span className="text-4xl">❓</span>
                  <p className="text-base font-semibold text-red-800">Product not found</p>
                  <p className="text-sm text-red-700 leading-relaxed">
                    This product isn't in our database yet. You can add it manually.
                  </p>
                  <button
                    onClick={() => { handleClose(); }}
                    className="px-5 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 transition-colors"
                  >
                    Add manually
                  </button>
                </>
              )}
              {lookupError === 'photo_fail' && (
                <>
                  <span className="text-4xl">📸</span>
                  <p className="text-base font-semibold text-red-800">Barcode not detected</p>
                  <p className="text-sm text-red-700 leading-relaxed">
                    Could not read a barcode from that photo. Try a clearer image, better lighting, or use the live camera scan.
                  </p>
                </>
              )}
              {lookupError !== 'not_found' && lookupError !== 'photo_fail' && (
                <>
                  <AlertCircle size={32} className="text-red-400" />
                  <p className="text-sm text-red-700">{lookupError}</p>
                </>
              )}
            </div>
          )}

          {/* ── Recent scans ── */}
          {recentFoods.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Clock size={14} className="text-gray-400" />
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Recent scans
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {recentFoods.map(food => (
                  <button
                    key={food.id}
                    onClick={() => { onFoodFound(food); handleClose(); }}
                    className="flex items-center gap-3 p-3.5 bg-gray-50 rounded-2xl hover:bg-primary-light transition-colors text-left"
                  >
                    <span className="text-2xl flex-shrink-0">
                      {CAT_EMOJI[food.category] || '🏷️'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{food.name}</p>
                      {food.brand && (
                        <p className="text-xs text-gray-400 truncate">{food.brand}</p>
                      )}
                    </div>
                    <span className="text-sm font-bold text-primary flex-shrink-0">
                      {Math.round(food.calories)} kcal
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
