import { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

/**
 * A small ❓ button that opens a friendly modal explaining the current page.
 * Drop one into the sticky header of any page.
 *
 * Props:
 *   title       — short page name shown in the modal header
 *   description — plain-English paragraph explaining what the page does
 */
export default function HelpModal({ title, description }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Help — ${title}`}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-primary-light hover:text-primary transition-all flex-shrink-0"
      >
        <HelpCircle size={20} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-title"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />

          {/* Sheet */}
          <div className="relative w-full max-w-app bg-white rounded-t-3xl px-6 pt-5 pb-10 animate-slide-up">
            {/* Drag handle */}
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            <div className="flex items-center justify-between mb-4">
              <h3 id="help-title" className="font-syne font-bold text-xl text-gray-900">
                About {title}
              </h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close help"
                className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-base text-gray-600 leading-relaxed">{description}</p>
          </div>
        </div>
      )}
    </>
  );
}
