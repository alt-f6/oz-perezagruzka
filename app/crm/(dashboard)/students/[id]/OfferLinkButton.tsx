"use client";

import { Copy } from "lucide-react";
import { useToast } from "@/crm/components/ToastProvider";
import { copyToClipboard } from "@/crm/lib/clipboard";
import { OFFER_URL } from "@/crm/lib/offerLink";

/**
 * Fallback for when the automatic first-payment offer email/Telegram send
 * failed (or simply hasn't fired yet) -- lets an operator hand the offer
 * link to the student/parent through any other channel.
 */
export function OfferLinkButton() {
  const showToast = useToast();

  const copy = async () => {
    const ok = await copyToClipboard(OFFER_URL);
    showToast(
      ok ? "Ссылка на оферту скопирована" : "Не удалось скопировать — скопируйте вручную: " + OFFER_URL,
      ok ? "success" : "error",
    );
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="btn-secondary inline-flex items-center gap-1.5 text-xs"
      title={OFFER_URL}
    >
      <Copy size={13} />
      Скопировать ссылку на оферту
    </button>
  );
}
