const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

/**
 * Current time as a naive ISO datetime string in IST, e.g. "2025-05-23T16:00:00".
 * No 'Z' / no offset suffix — matches what Spring Boot LocalDateTime expects.
 */
export function nowIST() {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 19);
}

/**
 * Today's date string in IST, e.g. "2025-05-23".
 */
export function todayIST() {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}
