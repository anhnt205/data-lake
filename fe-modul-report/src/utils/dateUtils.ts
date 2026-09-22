/**
 * Utility functions for date and time formatting in Vietnam timezone (GMT+7)
 */

export const formatVNDate = (iso?: string | null): string => {
  if (!iso) return "-";
  
  const trimmed = iso.trim();
  if (!trimmed) return "-";

  // Check if string already contains timezone info (Z or +/-HH:mm)
  const hasTimezone = /([+-]\d{2}(:\d{2})?|Z)$/i.test(trimmed);
  // If backend returns a local datetime without timezone (e.g. "2026-09-22T08:03:54.803024"),
  // treat it as Vietnam time (+07:00) so that JavaScript doesn't parse it as UTC and add another 7 hours.
  const isoStr = hasTimezone ? trimmed : `${trimmed}+07:00`;
  
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return iso;

  return d.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

export const formatVNDateOnly = (iso?: string | null): string => {
  if (!iso) return "-";
  
  const trimmed = iso.trim();
  if (!trimmed) return "-";

  const hasTimezone = /([+-]\d{2}(:\d{2})?|Z)$/i.test(trimmed);
  const isoStr = hasTimezone ? trimmed : `${trimmed}+07:00`;
  
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return iso;

  return d.toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};
