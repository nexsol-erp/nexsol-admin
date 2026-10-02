// One invoice shape for the designed layouts, built from what each web screen already has after
// saving: the Sales Entry's /sales/web-invoice answer, or the web POS bill. Pure.

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const lines = (s) => String(s || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

function taxSplit(lineList, interState) {
  const byRate = new Map();
  lineList.forEach((l) => {
    const rate = Number(l.taxRate) || 0;
    const row = byRate.get(rate) || { rate, taxable: 0, tax: 0 };
    row.taxable += Number(l.taxable) || 0;
    row.tax += Number(l.tax) || 0;
    byRate.set(rate, row);
  });
  return [...byRate.values()]
    .sort((a, b) => a.rate - b.rate)
    .map((row) => {
      const tax = r2(row.tax);
      const cgst = interState ? 0 : r2(tax / 2);
      return { rate: row.rate, taxable: r2(row.taxable), tax, cgst, sgst: interState ? 0 : r2(tax - cgst), igst: interState ? tax : 0 };
    });
}

// The Sales Entry invoice (POST /sales/web-invoice answer). branch is the branch master row, when
// the screen has it, for the phone number the answer doesn't carry.
export function fromSalesInvoice(inv, branch) {
  const b = branch || {};
  const ls = (inv.lines || []).map((l) => ({
    itemId: l.itemId,
    itemName: l.itemName,
    hsn: l.hsnCode || "",
    unit: l.unit || "",
    qty: Number(l.qty) || 0,
    rate: Number(l.rate) || 0,
    taxable: r2(l.taxableAmount),
    taxRate: Number(l.taxRate) || 0,
    tax: r2(l.taxAmount),
    amount: r2(l.amount),
  }));
  const interState = !!inv.interState;
  const payments = (inv.payments || []).map((p) => ({ mode: p.receiptMode, amount: r2(p.amount) }));
  const paid = inv.paidAmount != null ? r2(inv.paidAmount) : r2(payments.reduce((s, p) => s + p.amount, 0));
  return {
    kind: "SALES",
    voucherNumber: inv.voucherNumber || "",
    voucherDate: inv.voucherDate || "",
    credit: !!inv.credit,
    branch: {
      name: inv.branchName || b.branchName || inv.branchCode || "",
      addressLines: lines(inv.branchAddress),
      state: inv.branchState || b.branchState || "",
      phone: b.branchStreetAddress || "",
      gstin: inv.branchGst || b.branchGst || "",
    },
    customer: {
      name: inv.customerName || "",
      gstin: inv.customerGst || "",
      state: inv.customerState || "",
      mobile: inv.customerMobile || "",
      billingLines: lines(inv.billingAddress),
      shippingLines: lines(inv.deliveryAddress || inv.billingAddress),
    },
    placeOfSupply: inv.customerState || inv.branchState || "",
    interState,
    lines: ls,
    taxRows: taxSplit(ls, interState),
    taxableAmount: inv.taxableAmount != null ? r2(inv.taxableAmount) : r2(ls.reduce((s, l) => s + l.taxable, 0)),
    cgst: r2(inv.cgstAmount),
    sgst: r2(inv.sgstAmount),
    igst: r2(inv.igstAmount),
    totalAmount: r2(inv.totalAmount),
    payments,
    paidAmount: paid,
    balanceDue: inv.credit ? r2(inv.balanceDue != null ? inv.balanceDue : r2(inv.totalAmount) - paid) : 0,
    tendered: null,
    change: null,
  };
}

// The web POS bill as POSEntry keeps it for printing. Prices are tax-inclusive, as the server
// saves them (same split as the Sales Entry); walk-in bills are always within the state.
export function fromPosBill(bill) {
  const bi = bill.branchInfo || {};
  const ls = (bill.salesDetails || []).map((it) => {
    const qty = Number(it.qty ?? it.quantity) || 0;
    const rate = Number(it.rate) || 0;
    const amount = r2(it.amount != null ? it.amount : qty * rate);
    const taxRate = Number(it.taxRate ?? it.tax_rate ?? 0) || 0;
    const taxable = r2((amount * 100) / (100 + taxRate));
    return {
      itemId: it.itemId, itemName: it.itemName, hsn: it.hsnCode || "", unit: it.unit || "",
      qty, rate, taxable, taxRate, tax: r2(amount - taxable), amount,
    };
  });
  const taxRows = taxSplit(ls, false);
  const total = r2(bill.totalAmount != null ? bill.totalAmount : ls.reduce((s, l) => s + l.amount, 0));
  const tendered = Number(bill.tendered) > 0 ? r2(bill.tendered) : null;
  return {
    kind: "POS",
    voucherNumber: bill.voucherNumber || "",
    voucherDate: bill.voucherDate || "",
    credit: false,
    branch: {
      name: bi.branchName || bi.branchCode || "",
      addressLines: [bi.branchBuildingAddress, bi.branchAddress1, bi.branchAddress2].filter(Boolean),
      state: bi.branchState || "",
      phone: bi.branchStreetAddress || "",
      gstin: bi.branchGst || bill.gstin || "",
    },
    customer: {
      name: (bill.customer && bill.customer.name) || "Walk-In",
      gstin: (bill.customer && bill.customer.gst) || "",
      state: "",
      mobile: bill.customerMobile || (bill.customer && bill.customer.mobile) || "",
      billingLines: [],
      shippingLines: [],
    },
    placeOfSupply: bi.branchState || "",
    interState: false,
    lines: ls,
    taxRows,
    taxableAmount: r2(ls.reduce((s, l) => s + l.taxable, 0)),
    cgst: r2(taxRows.reduce((s, t) => s + t.cgst, 0)),
    sgst: r2(taxRows.reduce((s, t) => s + t.sgst, 0)),
    igst: 0,
    totalAmount: total,
    payments: [{ mode: "CASH", amount: total }],
    paidAmount: total,
    balanceDue: 0,
    tendered,
    change: tendered != null ? r2(Math.max(tendered - total, 0)) : null,
  };
}

// What the designer previews before any invoice exists.
export function sampleInvoice(kind) {
  const branch = {
    branchName: "Hotcakes Bakery", branchCode: "MAIN", branchState: "Kerala", branchGst: "32ABCDE1234F1Z5",
    branchBuildingAddress: "12 MG Road", branchAddress1: "Kochi 682016", branchStreetAddress: "+91 98470 00000",
  };
  if (kind === "POS") {
    return fromPosBill({
      branchInfo: branch, voucherNumber: "POS-1042", voucherDate: "2026-10-02", tendered: 1000,
      customer: { name: "Walk-In" },
      salesDetails: [
        { itemId: "i1", itemName: "Chocolate Truffle Cake 1kg", qty: 1, rate: 650, amount: 650, taxRate: 18 },
        { itemId: "i2", itemName: "Butter Croissant", qty: 4, rate: 45, amount: 180, taxRate: 5 },
        { itemId: "i3", itemName: "Cold Coffee", qty: 2, rate: 60, amount: 120, taxRate: 5 },
      ],
    });
  }
  const mk = (itemId, itemName, hsnCode, qty, amountIncl, taxRate) => {
    const taxableAmount = r2((amountIncl * 100) / (100 + taxRate));
    return { itemId, itemName, hsnCode, unit: "NOS", qty, rate: r2(taxableAmount / qty), taxableAmount, taxRate,
      taxAmount: r2(amountIncl - taxableAmount), amount: amountIncl };
  };
  const ls = [
    mk("i1", "Chocolate Truffle Cake 1kg", "1905", 10, 6500, 18),
    mk("i2", "Butter Croissant (box of 12)", "1905", 20, 10800, 5),
    mk("i3", "Packaged Drinking Water 1L", "2201", 48, 960, 18),
  ];
  const taxable = r2(ls.reduce((s, l) => s + l.taxableAmount, 0));
  const tax = r2(ls.reduce((s, l) => s + l.taxAmount, 0));
  return fromSalesInvoice({
    voucherNumber: "INV/2026/0158", voucherDate: "2026-10-02", credit: true,
    branchName: branch.branchName, branchCode: "MAIN", branchAddress: "12 MG Road\nKochi 682016",
    branchState: "Kerala", branchGst: branch.branchGst,
    customerName: "Acme Traders Pvt Ltd", customerGst: "32AAACA1234B1Z9", customerState: "Kerala",
    customerMobile: "+91 98950 12345", billingAddress: "45 Marine Drive\nErnakulam, Kerala 682031",
    deliveryAddress: "Warehouse 3, Kakkanad\nKochi, Kerala 682030", interState: false,
    taxableAmount: taxable, cgstAmount: r2(tax / 2), sgstAmount: r2(tax - r2(tax / 2)), igstAmount: 0,
    totalAmount: 18260, paidAmount: 5000, balanceDue: 13260,
    payments: [{ receiptMode: "UPI", amount: 5000 }], lines: ls,
  }, branch);
}
