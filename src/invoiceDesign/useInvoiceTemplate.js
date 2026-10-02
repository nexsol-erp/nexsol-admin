import { useEffect, useState } from "react";
import { templateInUse } from "./api";

// The Invoice Designer template a web invoice type ("POS" or "SALES") prints with, or null for
// the built-in invoice. Read once when the screen opens.
export default function useInvoiceTemplate(docType) {
  const [template, setTemplate] = useState(null);
  useEffect(() => {
    let live = true;
    templateInUse(docType).then((t) => { if (live) setTemplate(t); });
    return () => { live = false; };
  }, [docType]);
  return template;
}
