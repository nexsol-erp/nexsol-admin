import { useEffect } from "react";
import { getActiveFY } from "./accountingApi";

/**
 * Initialises from/to date fields to the active financial year's start/end dates.
 * Only sets the value if the field is still empty (doesn't override user input).
 *
 * Usage:
 *   useFinancialYear(setFrom, setTo);
 *   useFinancialYear(setFrom);          // to-date only left blank
 */
export function useFinancialYear(setFrom, setTo) {
  useEffect(() => {
    getActiveFY()
      .then((fy) => {
        if (!fy) return;
        if (setFrom && fy.startDate) setFrom((prev) => prev || fy.startDate);
        if (setTo   && fy.endDate)   setTo((prev)   => prev || fy.endDate);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
