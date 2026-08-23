import { prisma } from "@/landing/lib/db";

export interface RecordConsentInput {
  leadId?: string;
  consentType: string;
  documentSlug?: string;
  documentVersion: string;
  ipHash: string;
  userAgent: string;
}

/**
 * Writes a 152-FZ/63-FZ consent audit entry. Throws on failure — callers
 * (currently only attachLeadContact) must treat a failed write as a
 * failed request, since an unrecorded consent is a compliance gap, not
 * a soft error.
 */
export async function recordConsent(input: RecordConsentInput): Promise<void> {
  await prisma.consentLog.create({
    data: {
      leadId: input.leadId,
      consentType: input.consentType,
      documentSlug: input.documentSlug,
      documentVersion: input.documentVersion,
      ipHash: input.ipHash,
      userAgent: input.userAgent,
    },
  });
}
