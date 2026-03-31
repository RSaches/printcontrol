// src/utils/errors.ts

export type AppErrorCode =
  | "NotFound"
  | "DatabaseError"
  | "PermissionDenied"
  | "ValidationError"
  | "Unknown";

export interface AppError {
  code: AppErrorCode;
  message: string;
}

export function parseAppError(raw: unknown): AppError {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.code) return parsed as AppError;
    } catch {}
    return { code: "Unknown", message: raw };
  }
  return { code: "Unknown", message: String(raw) };
}

export function getErrorMessage(error: unknown): string {
  const appError = parseAppError(error);
  return appError.message;
}
