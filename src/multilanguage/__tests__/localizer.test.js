import fs from "fs";
import path from "path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { localizer, OFF } from "../localizer";
import { receiptHtml } from "../../components/kot/kotPrint";
import { taxInvoiceHtml } from "../../components/salesEntry/taxInvoiceHtml";
import { buildReceiptHtml } from "../../../pos-electron/src/pos/receiptHtml";
import InvoicePrint from "../../components/InvoicePrint";

const pack = (invoiceLanguage = "BILINGUAL") => ({
  enabled: true, invoiceLanguage, language: "ar", direction: "rtl",
  labels: { en: { TOTAL: "Total", TAX_INVOICE: "Tax Invoice", ITEM: "Item" }, local: { TOTAL: "الإجمالي", TAX_INVOICE: "فاتورة ضريبية", ITEM: "Item" } },
  branch: { name: "الفرع <الرئيسي>" },
  items: { i1: "كيكة شوكولاتة" },
  itemsByName: { "Tea <hot>": "شاي" },
});

test("the two copies of the localizer are the same file", () => {
  const a = fs.readFileSync(path.join(__dirname, "../localizer.js"), "utf8");
  const b = fs.readFileSync(path.join(__dirname, "../../../pos-electron/src/multilanguage/localizer.js"), "utf8");
  expect(b).toBe(a);
});

test("off hands everything back unchanged", () => {
  for (const L of [localizer(null), localizer(OFF), localizer({ enabled: false, language: "ar" }), localizer({ enabled: true })]) {
    expect(L.on).toBe(false);
    expect(L.css).toBe("");
    expect(L.label("TOTAL", "TOTAL")).toBe("TOTAL");
    expect(L.item("Tea &lt;hot&gt;", "Tea <hot>", "i2")).toBe("Tea &lt;hot&gt;");
    expect(L.branch("Shop")).toBe("Shop");
  }
});

test("bilingual puts the second language first, escaped and marked right to left", () => {
  const L = localizer(pack());
  expect(L.label("TOTAL", "TOTAL")).toBe('<span class="ml-l" lang="ar" dir="rtl">الإجمالي</span> / TOTAL');
  expect(L.stack("ITEM", "Item")).toBe("Item"); // same word as English: printed once
  expect(L.label("MISSING", "Qty")).toBe("Qty");
  expect(L.item("Chocolate Cake", "Chocolate Cake", "i1")).toBe('<div class="ml-l" lang="ar" dir="rtl">كيكة شوكولاتة</div>Chocolate Cake');
  expect(L.item("Tea &lt;hot&gt;", "Tea <hot>", "unknown")).toContain("شاي</div>Tea &lt;hot&gt;");
  expect(L.branch("Shop")).toBe('<div class="ml-l" lang="ar" dir="rtl">الفرع &lt;الرئيسي&gt;</div>Shop');
  expect(L.item("Coffee", "Coffee", "i9")).toBe("Coffee"); // no translation: English
});

test("local only prints the second language alone, English where it has no word", () => {
  const L = localizer(pack("LOCAL_ONLY"));
  expect(L.label("TOTAL", "TOTAL")).toBe('<span class="ml-l" lang="ar" dir="rtl">الإجمالي</span>');
  expect(L.item("Chocolate Cake", "Chocolate Cake", "i1")).toBe('<span class="ml-l" lang="ar" dir="rtl">كيكة شوكولاتة</span>');
  expect(L.item("Coffee", "Coffee", "i9")).toBe("Coffee");
});

test("every print path shows the second language when on", () => {
  const inv = { branchName: "Hotcakes", voucherNumber: "1", totalAmount: 20, taxableAmount: 17, cgstAmount: 1.5, sgstAmount: 1.5,
    lines: [{ itemId: "i1", itemName: "Chocolate Cake", qty: 1, rate: 20, amount: 20, taxRate: 15 }], payments: [] };
  for (const html of [
    receiptHtml({ inv, ml: pack() }),
    taxInvoiceHtml(inv, pack()),
    buildReceiptHtml({ items: [{ item_id: "i1", item_name: "Chocolate Cake", qty: 1, amount: 20, tax_rate: 15 }], totalAmount: 20,
      branchInfo: { branchName: "Hotcakes" }, voucherNumber: "1", ml: pack() }),
  ]) {
    expect(html).toContain("كيكة شوكولاتة");
    expect(html).toContain("فاتورة ضريبية");
    expect(html).toContain("الفرع &lt;الرئيسي&gt;");
    expect(html).toContain(".ml-l{");
    expect(html).toContain("Chocolate Cake");
  }
  const web = renderToStaticMarkup(<InvoicePrint ml={pack()} bill={{ branchInfo: { branchName: "Hotcakes" }, totalAmount: 20,
    salesDetails: [{ itemId: "i1", itemName: "Chocolate Cake", qty: 1, rate: 20, amount: 20 }] }} />);
  expect(web).toContain("كيكة شوكولاتة");
  expect(web).toContain("الإجمالي");
  expect(web).toContain('dir="rtl"');
});
