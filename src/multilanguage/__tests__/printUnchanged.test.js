// Every print path, printed without the multi-language module, must stay exactly as it was
// before the module existed. The snapshots were taken from the code before the module was
// added; a change here means an English-only tenant would see a different receipt.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { billHtml, kotSlipHtml, receiptHtml } from "../../components/kot/kotPrint";
import { taxInvoiceHtml } from "../../components/salesEntry/taxInvoiceHtml";
import { buildReceiptHtml } from "../../../pos-electron/src/pos/receiptHtml";
import InvoicePrint from "../../components/InvoicePrint";

process.env.TZ = "UTC";

beforeAll(() => {
  jest.useFakeTimers("modern");
  jest.setSystemTime(new Date("2026-09-27T10:15:00Z"));
});
afterAll(() => jest.useRealTimers());

const branch = { branchName: "Hotcakes Bakery", branchAddress: "12 King Road, Riyadh", branchGst: "310123456700003" };
const kotItems = [
  { itemId: "i1", itemName: "Chocolate Cake", qty: 2, rate: 10, amount: 20, taxRate: 15 },
  { itemId: "i2", itemName: "Tea <hot>", qty: 1, rate: 3.5, amount: 3.5, taxRate: 0 },
];
const inv = {
  ...branch, branchCode: "MAIN", branchState: "Riyadh", voucherNumber: "INV/0001", voucherDate: "2026-09-27",
  customerName: "Acme Traders", customerGst: "300000000000003", customerState: "Riyadh", customerMobile: "0500000000",
  billingAddress: "1 Olaya St\nRiyadh", interState: false, credit: false,
  taxableAmount: 20.43, cgstAmount: 1.53, sgstAmount: 1.54, igstAmount: 0, totalAmount: 23.5,
  lines: [
    { itemId: "i1", itemName: "Chocolate Cake", hsnCode: "1905", qty: 2, rate: 8.7, taxableAmount: 17.39, taxRate: 15, taxAmount: 2.61, amount: 20 },
    { itemId: "i2", itemName: "Tea <hot>", hsnCode: "", qty: 1, rate: 3.5, taxableAmount: 3.04, taxRate: 0, taxAmount: 0, amount: 3.5 },
  ],
  payments: [{ receiptMode: "CASH", amount: 23.5 }],
};

test("KOT slip, proforma bill and receipt", () => {
  expect(kotSlipHtml({ branch, kotNumber: "K12", tableName: "T4", salesMan: "Ali", items: kotItems })).toMatchSnapshot();
  expect(billHtml({ branch, kotNumber: "K12", tableName: "T4", salesMan: "Ali", items: kotItems })).toMatchSnapshot();
  expect(receiptHtml({ inv, tableName: "T4", salesMan: "Ali", tendered: 50 })).toMatchSnapshot();
});

test("A4 tax invoice", () => {
  expect(taxInvoiceHtml(inv)).toMatchSnapshot();
  expect(taxInvoiceHtml({ ...inv, credit: true, balanceDue: 23.5, interState: true, igstAmount: 3.07, customerGst: "" })).toMatchSnapshot();
});

test("desktop POS receipt", () => {
  const b = { branchName: "Hotcakes Bakery", branchCode: "MAIN", branchBuildingAddress: "12 King Road", branchState: "Riyadh",
    branchStreetAddress: "0110000000", branchGst: "310123456700003" };
  const items = [
    { item_id: "i1", item_name: "Chocolate Cake", qty: 2, amount: 20, tax_rate: 15 },
    { item_id: "i2", item_name: "Tea <hot>", qty: 1, amount: 3.5, tax_rate: 0 },
  ];
  expect(buildReceiptHtml({ items, totalAmount: 23.5, tendered: 50, balance: 26.5, receipts: [{ receipt_mode: "CASH", amount: 23.5 }],
    branchInfo: b, salesmanName: "Ali", customerMobile: "0500000000", voucherNumber: "P-1" })).toMatchSnapshot();
  expect(buildReceiptHtml({ items, totalAmount: 23.5, itemwiseDiscount: 1, roundOff: 0.5, receipts: [], branchInfo: b,
    posAddressLines: ["Line A", "Line B"], voucherNumber: "P-2" })).toMatchSnapshot();
});

test("web POS receipt", () => {
  const bill = { branchInfo: { branchName: "Hotcakes Bakery", branchBuildingAddress: "12 King Road", branchState: "Riyadh",
    branchStreetAddress: "0110000000", branchGst: "310123456700003" }, voucherNumber: "W-1", voucherDate: "2026-09-27",
    customer: { name: "Walk-in" }, totalAmount: 23.5, tendered: 50,
    salesDetails: [{ itemId: "i1", itemName: "Chocolate Cake", qty: 2, rate: 10, amount: 20, taxRate: 15 },
      { itemId: "i2", itemName: "Tea <hot>", qty: 1, rate: 3.5, amount: 3.5, taxRate: 0 }] };
  expect(renderToStaticMarkup(<InvoicePrint bill={bill} />)).toMatchSnapshot();
});
