"use client";

import { useState, useEffect } from "react";

interface ShareSectionProps {
  leadId?: string;
}

export function ShareSection({ leadId }: ShareSectionProps) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    Promise.resolve().then(() => {
      if (isCurrent) {
        setMounted(true);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  if (!mounted) {
    return null;
  }

  const baseUrl = window.location.origin + window.location.pathname;
  const shareUrl = leadId ? baseUrl + "?result=" + leadId : baseUrl;
  const shareText = "Я составил персональную карту готовности к ОГЭ! Проверь свою здесь:";

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Карта готовности к ОГЭ",
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        console.log("Native share failed or dismissed:", err);
      }
    } else {
      handleCopy();
    }
  };

  const handleCopy = () => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(shareText + " " + shareUrl);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="mt-8 border-t border-ink-100 pt-8 no-print">
      <h4 className="text-sm font-bold text-ink-700 mb-4 text-center tracking-tight">
        Поделиться результатом или сохранить карту:
      </h4>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Official brand colors (Telegram/WhatsApp); intentional exception to the brand/accent/ink token palette, for recognizability */}
        <a
          href={"https://t.me/share/url?url=" + encodeURIComponent(shareUrl) + "&text=" + encodeURIComponent(shareText)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white py-3.5 px-3 text-xs font-bold text-ink-700 transition-all hover:border-sky-400/60 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 active:scale-95"
        >
          <svg className="h-5 w-5 text-[#229ED9] fill-current" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.94-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.37.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z"/>
          </svg>
          Telegram
        </a>

        <a
          href={"https://api.whatsapp.com/send?text=" + encodeURIComponent(shareText + " " + shareUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white py-3.5 px-3 text-xs font-bold text-ink-700 transition-all hover:border-emerald-400/60 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 active:scale-95"
        >
          <svg className="h-5 w-5 text-[#25D366] fill-current" viewBox="0 0 24 24">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.739-1.45L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.966C16.59 2.012 14.125.99 11.514.99 6.08.99 1.657 5.361 1.654 10.792c-.002 1.761.464 3.479 1.35 4.98l-.995 3.637 3.737-.97c1.472.802 3.11 1.222 4.717 1.222h.001z"/>
          </svg>
          WhatsApp
        </a>

        <button
          type="button"
          onClick={handleNativeShare}
          className="flex items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white py-3.5 px-3 text-xs font-bold text-ink-700 transition-all hover:border-brand-400/60 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 active:scale-95"
        >
          <svg className="h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Поделиться
        </button>

        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white py-3.5 px-3 text-xs font-bold text-ink-700 transition-all hover:border-accent-400/60 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 active:scale-95"
        >
          <svg className="h-5 w-5 text-accent-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Сохранить (PDF)
        </button>
      </div>

      {copied && (
        <p className="text-center text-[11px] font-bold text-brand-600 mt-2.5 animate-pulse">
          Ссылка с текстом успешно скопирована в буфер обмена!
        </p>
      )}
    </div>
  );
}