import { prisma } from "@/landing/lib/db";
import { createLogger } from "@/shared/lib/logger";

const log = createLogger("consent-log");

export interface RecordConsentInput {
  leadId?: string;
  consentType: string;
  documentSlug?: string;
  documentVersion: string;
  ipHash: string;
  userAgent: string;
}

/**
 * Writes a 152-FZ/63-FZ consent audit entry. Never throws — a failed audit
 * write must not block the lead-capture or readiness-map flow it's attached
 * to; callers get a resolved promise either way and the failure is logged.
 */
export async function recordConsent(input: RecordConsentInput): Promise<void> {
  try {
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
  } catch (error) {
    log.error("Write failed", error, {
      leadId: input.leadId,
      consentType: input.consentType,
      documentSlug: input.documentSlug,
      documentVersion: input.documentVersion,
    });
  }
}
