/** PATCH /api/contribute/projects/[id]/facts/[factId] — confirm, correct, reject, reopen, set sharing permission, or fill in details. */
import type { NextRequest } from "next/server";

import { body, failure, handle, json, text } from "@/server/capture/http";
import { reviewFact, type FactAction } from "@/server/capture/review-service";

export const dynamic = "force-dynamic";

const PERMISSIONS = ["public", "anonymize", "private"] as const;
const permission = (value: unknown) => PERMISSIONS.find((item) => item === value);

export const PATCH = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/facts/[factId]">) =>
  handle(
    request,
    async (user) => {
      const input = await body<Record<string, unknown>>(request);
      const { id, factId } = await params;
      let change: FactAction;
      switch (input.action) {
        case "confirm":
          change = { action: "confirm", permission: permission(input.permission), anonymizedStatement: text(input.anonymizedStatement, 1500) || undefined };
          break;
        case "correct":
          change = { action: "correct", statement: text(input.statement, 1500), permission: permission(input.permission), anonymizedStatement: text(input.anonymizedStatement, 1500) || undefined };
          break;
        case "reject":
        case "reopen":
          change = { action: input.action };
          break;
        case "permission": {
          const chosen = permission(input.permission);
          if (!chosen) return failure(400, "Choose whether this can be shared, shared anonymised, or kept private.");
          change = { action: "permission", permission: chosen, anonymizedStatement: text(input.anonymizedStatement, 1500) || undefined };
          break;
        }
        case "details": {
          const details: Record<string, string | null> = {};
          for (const [key, value] of Object.entries((input.details ?? {}) as Record<string, unknown>)) details[key] = typeof value === "string" ? value : null;
          change = { action: "details", details };
          break;
        }
        default:
          return failure(400, "That request could not be read.");
      }
      return json({ fact: await reviewFact(user.id, id, factId, change) });
    },
    { write: true },
  );
