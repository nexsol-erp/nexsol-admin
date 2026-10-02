import { renderInvoiceHtml as invoiceHtml, amountInWords } from "../renderInvoice";
import { fromPosBill, fromSalesInvoice, sampleInvoice } from "../invoiceModel";
import { DEFAULT_CONFIG, presetConfig, withDefaults } from "../templateModel";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const salesInv = {
  voucherNumber: "INV/0001", voucherDate: "2026-09-27", credit: true, branchName: "Hotcakes Bakery", branchCode: "MAIN",
  branchAddress: "12 King Road\nKochi", branchState: "Kerala", branchGst: "32ABCDE1234F1Z5",
  customerName: "Acme <Traders>", customerGst: "32AAACA1234B1Z9", customerState: "Kerala", customerMobile: "9895012345",
  billingAddress: "1 Marine Drive", deliveryAddress: "Warehouse 3", interState: false,
  taxableAmount: 20.43, cgstAmount: 1.53, sgstAmount: 1.54, igstAmount: 0, totalAmount: 23.5, paidAmount: 10, balanceDue: 13.5,
  lines: [
    { itemId: "i1", itemName: "Chocolate Cake", hsnCode: "1905", qty: 2, rate: 8.7, taxableAmount: 17.39, taxRate: 15, taxAmount: 2.61, amount: 20 },
    { itemId: "i2", itemName: "Tea <hot>", hsnCode: "", qty: 1, rate: 3.5, taxableAmount: 3.04, taxRate: 0, taxAmount: 0, amount: 3.5 },
  ],
  payments: [{ receiptMode: "UPI", amount: 10 }],
};

test("a partial or odd config is filled from the defaults without changing them", () => {
  const before = JSON.stringify(DEFAULT_CONFIG);
  const t = withDefaults({ paper: "A5", logo: { height: 9999 }, accent: "red", columns: [{ key: "amount", label: "Total" }, { key: "bogus" }] });
  expect(t.paper).toBe("A5");
  expect(t.logo.height).toBe(DEFAULT_CONFIG.logo.height);
  expect(t.accent).toBe(DEFAULT_CONFIG.accent);
  expect(t.columns[0]).toEqual({ key: "amount", label: "Total", show: true });
  expect(t.columns.map((c) => c.key)).toHaveLength(DEFAULT_CONFIG.columns.length);
  expect(t.columns.filter((c) => c.show).map((c) => c.key)).toEqual(["amount"]);
  expect(JSON.stringify(DEFAULT_CONFIG)).toBe(before);
});

test("sales invoice prints the chosen details, columns, logo and totals", () => {
  const config = withDefaults({ business: { name: "Hotcakes Pvt Ltd", extraLines: "hello@hotcakes.in" }, footer: { bankDetails: "SBI 123", terms: "No returns" } });
  config.columns = config.columns.map((c) => ({ ...c, show: ["item", "qty", "amount"].includes(c.key), label: c.key === "amount" ? "Line total" : c.label }));
  const out = invoiceHtml({ config, logo: PNG }, fromSalesInvoice(salesInv));
  expect(out).toContain(`src="${PNG}"`);
  expect(out).toContain("Hotcakes Pvt Ltd");
  expect(out).toContain("hello@hotcakes.in");
  expect(out).toContain("TAX INVOICE (CREDIT)");
  expect(out).toContain("Acme &lt;Traders&gt;");
  expect(out).toContain("Tea &lt;hot&gt;");
  expect(out).not.toContain("<hot>");
  expect(out).toContain("Line total");
  expect(out).not.toContain(">HSN/SAC<");
  expect(out).toContain("Warehouse 3");
  expect(out).toContain("Balance due");
  expect(out).toContain("13.50");
  expect(out).toContain("Paid by UPI");
  expect(out).toContain("Rupees Twenty Three and Fifty Paise Only");
  expect(out).toContain("SBI 123");
  expect(out).toContain("No returns");
  expect(out).toContain("Authorised Signatory");
  expect(out).toContain("@page{size:A4;margin:12mm}");
});

test("switching details off removes them", () => {
  const config = withDefaults({ details: { showShipTo: false, showCustomerGstin: false }, totals: { showAmountInWords: false },
    footer: { showSignature: false }, business: { showGstin: false } });
  const out = invoiceHtml({ config }, fromSalesInvoice(salesInv));
  expect(out).not.toContain("Warehouse 3");
  expect(out).not.toContain("32AAACA1234B1Z9");
  expect(out).not.toContain("32ABCDE1234F1Z5");
  expect(out).not.toContain("Rupees");
  expect(out).not.toContain("Authorised Signatory");
});

test("a logo that isn't a data: image is never printed", () => {
  const out = invoiceHtml({ config: {}, logo: ["javascript", "alert(1)"].join(":") }, fromSalesInvoice(salesInv));
  expect(out).not.toContain(["javascript", ""].join(":"));
  expect(out).not.toContain("<img");
});

test("user text can't break out of the page", () => {
  const out = invoiceHtml({ config: { footer: { notes: "</style><script>x()</script>" }, title: { sales: "<b>T</b>" } } }, fromSalesInvoice(salesInv));
  expect(out).not.toContain("<script>");
  expect(out).toContain("&lt;b&gt;T&lt;/b&gt;");
});

test("web POS bill on an 80 mm receipt template", () => {
  const bill = {
    branchInfo: { branchName: "Hotcakes Bakery", branchBuildingAddress: "12 King Road", branchStreetAddress: "0484 000000", branchGst: "32ABCDE1234F1Z5", branchState: "Kerala" },
    voucherNumber: "W-1", voucherDate: "2026-09-27", customer: { name: "POS" }, totalAmount: 23.5, tendered: 50,
    salesDetails: [{ itemId: "i1", itemName: "Chocolate Cake", qty: 2, rate: 10, amount: 20, taxRate: 18 },
      { itemId: "i2", itemName: "Tea", qty: 1, rate: 3.5, amount: 3.5, taxRate: 0 }],
  };
  const inv = fromPosBill(bill);
  // Prices include tax, as the server saves the bill.
  expect(inv.lines[0].taxable).toBe(16.95);
  expect(inv.lines[0].tax).toBe(3.05);
  expect(inv.change).toBe(26.5);
  const out = invoiceHtml({ config: presetConfig("thermal") }, inv);
  expect(out).toContain("@page{size:80mm auto;margin:0}");
  expect(out).toContain("CGST @9%");
  expect(out).toContain("1.53");
  expect(out).toContain("26.50");
  expect(out).toContain("Ph: 0484 000000");
  expect(out).not.toContain("HSN");
});

test("multi-language pack adds the second language to item names", () => {
  const ml = { enabled: true, language: "ar", direction: "rtl", invoiceLanguage: "BILINGUAL",
    labels: { en: {}, local: { ITEM: "الصنف" } }, items: { i1: "كيكة شوكولاتة" } };
  const out = invoiceHtml({ config: {} }, fromSalesInvoice(salesInv), ml);
  expect(out).toContain("كيكة شوكولاتة");
  expect(out).toContain("الصنف");
});

test("amount in words", () => {
  expect(amountInWords(18260, "₹")).toBe("Rupees Eighteen Thousand Two Hundred Sixty Only");
  expect(amountInWords(1250000.5, "₹")).toBe("Rupees Twelve Lakh Fifty Thousand and Fifty Paise Only");
  expect(amountInWords(1250000.5, "SAR")).toBe("One Million Two Hundred Fifty Thousand and 50/100 Only");
  expect(amountInWords(0, "")).toBe("Zero Only");
});

test("designer samples render for both invoice types and every preset", () => {
  ["modern", "classic", "minimal", "bold", "thermal"].forEach((p) => {
    ["SALES", "POS"].forEach((k) => {
      const out = invoiceHtml({ config: presetConfig(p), logo: PNG }, sampleInvoice(k));
      expect(out).toMatch(/^<!doctype html>/);
      expect(out).toContain("Hotcakes Bakery");
    });
  });
});
