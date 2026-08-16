import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lms/server/http/api-error";

type AnyResponse = Response | NextResponse;
type MaybePromise<T> = T | Promise<T>;

export function withApiErrors(
  handler: (req: NextRequest) => MaybePromise<AnyResponse>
): (req: NextRequest) => Promise<AnyResponse>;

export function withApiErrors<TCtx>(
  handler: (req: NextRequest, ctx: TCtx) => MaybePromise<AnyResponse>
): (req: NextRequest, ctx: TCtx) => Promise<AnyResponse>;

export function withApiErrors(handler: any) {
  return async (req: NextRequest, ctx?: any) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      return apiError(e);
    }
  };
}
