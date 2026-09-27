import { useEffect, useState } from "react";
import { OFF } from "./localizer";
import { loadPrintPack } from "./printPack";

// The branch's print pack, OFF until it has loaded (and whenever the module is off).
export default function usePrintPack(branchCode) {
  const [pack, setPack] = useState(OFF);
  useEffect(() => {
    let live = true;
    setPack(OFF);
    loadPrintPack(branchCode).then((p) => live && setPack(p));
    return () => { live = false; };
  }, [branchCode]);
  return pack;
}
