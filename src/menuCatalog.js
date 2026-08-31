// ============================================================================
// MENU CATALOG - single source of truth for the application menu tree.
//
// Consumed by:
//   - Sidebar          : renders the tree as-is (labels go through t()).
//   - GlobalMenuSearch : flattens it for the top-bar search.
//   - MenuMapPage      : renders it as the browsable feature map.
//
// `menuKey` must match the menu name stored on the backend (role-menu
// assignments), since that is what drives visibility.
// ============================================================================
import {
  Dashboard,
  AutoGraph,
  Receipt,
  ShoppingCart,
  Category,
  Scale,
  AddBusiness,
  Business,
  Hub,
  Loyalty,
  Tune,
  Assessment,
  PlaylistAddCheck,
  HelpOutline,
  Insights,
  AccountBalance,
  Build,
  Assignment,
} from "@mui/icons-material";

export const MENU_TREE = [
  // -- Dashboard & Intelligence ---------------------------------------------
  { menuKey: "Dashboard",             label: "Dashboard",             icon: Dashboard,  color: "#1565C0", link: "/dashboard",    roles: ["admin", "manager"] },
  { menuKey: "AI Stock Intelligence", label: "AI Stock Intelligence", icon: AutoGraph,  color: "#1565C0", link: "/ai-dashboard", roles: ["admin", "manager"] },
  { menuKey: "AI Report Assistant",   label: "AI Report Assistant",   icon: AutoGraph,  color: "#1565C0", link: "/ai-report",    roles: ["admin", "manager", "user"] },
  { menuKey: "My Tasks",              label: "My Tasks",              icon: Assignment, color: "#1565C0", link: "/my-tasks",     roles: ["admin", "manager", "user", "WB"] },
  { menuKey: "Product 360",           label: "Product 360",           icon: Insights,   color: "#1565C0", link: "/product-360",  roles: ["admin", "manager", "user"] },

  // -- Setup & Administration -----------------------------------------------
  {
    menuKey: "Initial Setup", label: "Setup & Administration", icon: PlaylistAddCheck, color: "#4A148C", link: "",
    roles: ["admin", "WB"], hasSubmenu: true,
    submenu: [
      { menuKey: "Menu Master",                 label: "1. Create Menus",                link: "/menu-master",                roles: ["admin"] },
      { menuKey: "Role Management",             label: "2. Create Roles",                link: "/role-management",            roles: ["admin"] },
      { menuKey: "Role Menu Access",            label: "3. Assign Menus to Roles",       link: "/role-menu",                  roles: ["admin"] },
      { menuKey: "Branch Creation",             label: "4. Create Branches",             link: "/branchcreationpage",         roles: ["admin"] },
      { menuKey: "User Creation",               label: "5. Create Users",                link: "/usercreationpage",           roles: ["admin"] },
      { menuKey: "Branch Assignment",           label: "6. Assign Branches & Roles",     link: "/branchassingment",           roles: ["admin"] },
      { menuKey: "Transfer Branch Permissions", label: "7. Transfer Branch Permissions", link: "/branch-transfer-assignment", roles: ["admin"] },
      { menuKey: "Branch Day End Settings",     label: "Branch Day End Settings",        link: "/branch-day-end-settings",    roles: ["admin"] },
      { menuKey: "Clear Day End",               label: "Clear Day End",                  link: "/day-end-clear",              roles: ["admin"] },
      { menuKey: "Version Management",          label: "Version Management",             link: "/version-management",         roles: ["admin"] },
      { menuKey: "Admin Page",                  label: "Admin Page",                     link: "/branch-request-list",        roles: ["admin", "WB"] },
      { menuKey: "Reprocess Voucher",           label: "Reprocess Voucher",              link: "/reprocess-voucher-form",     roles: ["admin", "WB"] },
      { menuKey: "POS Machine Approval",        label: "POS Machine Approval",           link: "/pos-machine-approval",       roles: ["admin", "MACHINE_ADMIN"] },
      { menuKey: "Connected POS Terminals",     label: "Connected POS Terminals",        link: "/pos-sessions",               roles: ["admin"] },
      { menuKey: "UPI Payment Setup",           label: "UPI Payment Setup",              link: "/upi-config",                 roles: ["admin"] },
      { menuKey: "Cost Stamping",               label: "Cost & Profit Stamping",         link: "/cost-stamping",              roles: ["admin"] },
    ],
  },

  // -- Sales ----------------------------------------------------------------
  {
    menuKey: "Sales", label: "Sales", icon: Receipt, color: "#C62828", link: "",
    roles: ["admin", "user"], hasSubmenu: true,
    submenu: [
      { menuKey: "POS",         label: "POS",         link: "/pos",            roles: ["admin", "user"] },
      { menuKey: "KOT",         label: "KOT",         link: "/kot",            roles: ["admin", "user"] },
      { menuKey: "Sales Entry", label: "Sales Entry", link: "/salesentryform", roles: ["admin"] },
    ],
  },

  // -- Purchase -------------------------------------------------------------
  {
    menuKey: "Purchase", label: "Purchase", icon: ShoppingCart, color: "#BF360C", link: "",
    roles: ["admin", "manager", "user"], hasSubmenu: true,
    submenu: [
      { menuKey: "Purchase Entry",               label: "Purchase Entry",               link: "/purchaseentry",                roles: ["user", "manager", "admin"] },
      { menuKey: "Goods Receipt",                label: "Goods Receipt",                link: "/goodsreceipt",                 roles: ["user", "manager", "admin"] },
      { menuKey: "Purchase Correction",          label: "Purchase Correction",          link: "/purchase-correction",          roles: ["admin", "manager"] },
      { menuKey: "Purchase Correction Approval", label: "Purchase Correction Approval", link: "/purchase-correction-approval", roles: ["admin", "manager"] },
      { menuKey: "Purchase Correction History",  label: "Purchase Correction History",  link: "/purchase-correction-history",  roles: ["admin", "manager", "user"] },
    ],
  },

  // -- Production -----------------------------------------------------------
  {
    menuKey: "Production", label: "Production", icon: Category, color: "#1B5E20", link: "",
    roles: ["admin", "manager", "user"], hasSubmenu: true,
    submenu: [
      { menuKey: "Production Def",       label: "Production Def",       link: "/production-def",       roles: ["admin", "manager", "user"] },
      { menuKey: "Production Planning",  label: "Production Planning",  link: "/production-planning",  roles: ["admin", "manager", "user"] },
      { menuKey: "Production Execution", label: "Production Execution", link: "/production-execution", roles: ["admin", "manager", "user"] },
    ],
  },

  // -- Stock Operations -----------------------------------------------------
  {
    menuKey: "Stock Operations", label: "Stock Operations", icon: AddBusiness, color: "#006064", link: "",
    roles: ["admin", "manager"], hasSubmenu: true,
    submenu: [
      { menuKey: "Physical Stock Correction", label: "Physical Stock Correction", link: "/physical-stock-correction", roles: ["admin", "manager"] },
    ],
  },

  // -- Weighbridge ----------------------------------------------------------
  {
    menuKey: "Weighbridge Group", label: "Weighbridge", icon: Scale, color: "#37474F", link: "",
    roles: ["WB"], hasSubmenu: true,
    submenu: [
      { menuKey: "Weighbridge",        label: "Weighbridge Entry", link: "/weighbridge",        roles: ["WB"] },
      { menuKey: "Weight-Count",       label: "Weight-Count",      link: "/bridge-count",       roles: ["WB"] },
      { menuKey: "WeighBridge Usage",  label: "WeighBridge Usage", link: "/weighbridgeusage",   roles: ["WB"] },
      { menuKey: "Weighbridge Resync", label: "Resync Records",    link: "/weighbridge-resync", roles: ["WB", "admin"] },
    ],
  },

  // -- Scheme ---------------------------------------------------------------
  {
    menuKey: "Scheme", label: "Scheme", icon: Loyalty, color: "#880E4F", link: "",
    roles: ["admin"], hasSubmenu: true,
    submenu: [
      { menuKey: "Scheme Creation", label: "Scheme Creation", link: "/schemepage",        roles: ["admin"] },
      { menuKey: "Manage Scheme",   label: "Manage Scheme",   link: "/publishschemepage", roles: ["admin"] },
    ],
  },

  // -- Masters --------------------------------------------------------------
  {
    menuKey: "Masters", label: "Masters", icon: Tune, color: "#004D40", link: "",
    roles: ["admin", "user", "cgn", "franchiseeuser"], hasSubmenu: true,
    submenu: [
      { menuKey: "Branch Details",            label: "Branch Details",            link: "/branch-update",           roles: ["admin"] },
      { menuKey: "POS Address Configuration", label: "POS Address Configuration", link: "/pos-address-config",      roles: ["admin"] },
      { menuKey: "Item Cost Override",        label: "Item Cost Override",        link: "/item-cost-override",      roles: ["admin"] },
      { menuKey: "Cost Price History",        label: "Cost Price History",        link: "/cost-price-history",      roles: ["admin"] },
      { menuKey: "Receipt Modes",             label: "Receipt Modes",             link: "/receipt-modes",           roles: ["admin"] },
      { menuKey: "Item Search",               label: "Item Search",               link: "/itemsearch",              roles: ["admin", "user", "cgn", "franchiseeuser"] },
      { menuKey: "Item Creation",             label: "Item Creation",             link: "/createitemmaster",        roles: ["admin", "user"] },
      { menuKey: "Branch Price",              label: "Branch Price",              link: "/branch-price",            roles: ["admin", "franchiseeuser"] },
      { menuKey: "Stock Transfer Discount",   label: "Stock Transfer Discount",   link: "/stock-transfer-discount", roles: ["admin"] },
      { menuKey: "Price Edit Category Wise",  label: "Price Edit Category Wise",  link: "/category-price-edit",     roles: ["admin", "user"] },
      { menuKey: "Category Type",             label: "Category Type",             link: "/categorytypemaster",      roles: ["admin", "user"] },
      { menuKey: "Category Name",             label: "Category Name",             link: "/categorynamemaster",      roles: ["admin", "user"] },
      { menuKey: "Category Link",             label: "Category Link",             link: "/item-category-linker",    roles: ["admin", "user"] },
      { menuKey: "Report Exclusions",         label: "Report Exclusions",         link: "/report-exclusions",       roles: ["admin"] },
      { menuKey: "Tax Update Manager",        label: "Tax Update Manager",        link: "/tax-update-manager",      roles: ["admin", "user"] },
      { menuKey: "Tax Update Preview",        label: "Tax Update Preview",        link: "/tax-update-preview",      roles: ["admin", "user"] },
      { menuKey: "Supplier Creation",         label: "Supplier Creation",         link: "/suppliercreation",        roles: ["admin", "user", "cgn"] },
    ],
  },

  // -- Reports --------------------------------------------------------------
  {
    menuKey: "Reports", label: "Reports", icon: Assessment, color: "#283593", link: "",
    roles: ["admin", "manager", "cgn", "user", "franchiseeuser", "WB"], hasSubmenu: true,
    submenu: [
      // Sales
      { menuKey: "Sales Report",                         label: "Sales Report",                         link: "/sales",                                 roles: ["admin", "user", "manager", "franchiseeuser"] },
      { menuKey: "Sales Re Print",                       label: "Sales Re Print",                       link: "/salessummaryreport",                    roles: ["admin", "user", "manager", "franchiseeuser"] },
      { menuKey: "Sales Tax Summary",                    label: "Sales Tax Summary",                    link: "/salestaxsummary",                       roles: ["admin", "user", "manager", "franchiseeuser"] },
      { menuKey: "HSN wise Sales",                       label: "HSN wise Sales",                       link: "/hsnsales",                              roles: ["admin", "franchiseeuser", "user"] },
      { menuKey: "HSN Sales Summary",                    label: "HSN Sales Summary",                    link: "/hsn-sales-summary",                     roles: ["admin", "franchiseeuser", "user"] },
      { menuKey: "All Branch Sales Report",              label: "All Branch Sales Report",              link: "/sales-report-all-branch",               roles: ["admin", "user", "manager"] },
      { menuKey: "All Branch Categorywise Sales Report", label: "All Branch Categorywise Sales Report", link: "/sales-category-wise-report-all-branch", roles: ["admin", "user", "manager"] },
      { menuKey: "Season Sales Report",                  label: "Season Sales Report",                  link: "/seasonalreport",                        roles: ["admin"] },
      { menuKey: "Salesman Report",                      label: "Salesman Report",                      link: "/salesman-report",                       roles: ["admin", "manager", "user"] },
      // Purchase
      { menuKey: "Purchase Report",                      label: "Purchase Report",                      link: "/purchasereport",                        roles: ["admin", "user", "manager", "franchiseeuser"] },
      { menuKey: "HSN wise Purchase",                    label: "HSN wise Purchase",                    link: "/hsnwise-purchase-report",               roles: ["admin", "user"] },
      // Stock & Inventory
      { menuKey: "Item Stock Report",                    label: "Item Stock Report",                    link: "/item-stock-report",                     roles: ["admin", "user", "manager", "cgn"] },
      { menuKey: "All Branch Stock Report",              label: "All Branch Stock Report",              link: "/stock-report-all-branch",               roles: ["admin", "user", "manager", "cgn", "franchiseeuser"] },
      { menuKey: "Branch Stock Report",                  label: "Branch Stock Report",                  link: "/branch-stock-view",                     roles: ["admin", "manager", "user", "franchiseeuser"] },
      { menuKey: "Branch Stock Management",              label: "Branch Stock Management",              link: "/branch-stock-report",                   roles: ["admin"] },
      { menuKey: "Branch Inventory Report",              label: "Branch Inventory Report",              link: "/branch-inventory",                      roles: ["admin", "manager", "user", "franchiseeuser"] },
      { menuKey: "Branch Inventory Ledger",              label: "Branch Inventory Ledger",              link: "/branch-inventory-ledger",               roles: ["admin", "manager", "user", "franchiseeuser"] },
      { menuKey: "Stock Movement Report",                label: "Stock Movement Report",                link: "/stockmovementreport",                   roles: ["admin", "user", "manager", "franchiseeuser"] },
      { menuKey: "Physical Stock Report",                label: "Physical Stock Report",                link: "/physicalstockreport",                   roles: ["admin", "user", "manager", "franchiseeuser"] },
      { menuKey: "Stock Turnover Report",                label: "Stock Turnover Report",                link: "/stock-turnover",                        roles: ["user", "admin"] },
      { menuKey: "Stock Anomaly Report",                 label: "Stock Anomaly Report",                 link: "/stock-anomaly-report",                  roles: ["admin", "manager"] },
      // Item analysis
      { menuKey: "Item Sales Report",                    label: "Item Sales Report",                    link: "/item-sales",                            roles: ["user", "admin"] },
      { menuKey: "Item Movement Report",                 label: "Item Movement Report",                 link: "/item-movement-report",                  roles: ["admin", "user", "manager", "franchiseeuser"] },
      { menuKey: "Item Velocity Report",                 label: "Item Velocity Report",                 link: "/item-velocity-report",                  roles: ["admin", "user", "manager", "franchiseeuser"] },
      { menuKey: "Item Transfer Report",                 label: "Item Transfer Report",                 link: "/item-transfer-report",                  roles: ["admin", "manager", "user", "franchiseeuser"] },
      { menuKey: "Category Item Report",                 label: "Category Item Report",                 link: "/category-item-report",                  roles: ["admin", "manager", "user"] },
      { menuKey: "Stock Transfer In Report",             label: "Stock Transfer In Report",             link: "/stocktransfer-in-report",               roles: ["admin", "franchiseeuser", "user"] },
      { menuKey: "Stock Transfer Out Report",            label: "Stock Transfer Out Report",            link: "/stocktransfer-out-report",              roles: ["admin", "franchiseeuser"] },
      // Production
      { menuKey: "Production Planning Report",           label: "Production Planning Report",           link: "/production-planning-report",            roles: ["admin", "manager", "user"] },
      { menuKey: "Production Execution Report",          label: "Production Execution Report",          link: "/production-execution-report",           roles: ["admin", "manager", "user"] },
      // Profit
      { menuKey: "Branch Profit Report",                 label: "Branch Profit Report",                 link: "/branch-profit-report",                  roles: ["admin", "manager"] },
      { menuKey: "Monthly Branch Profit Report",         label: "Monthly Branch Profit Report",         link: "/monthly-branch-profit-report",          roles: ["admin", "manager"] },
      // Operations
      { menuKey: "Day End Report",                       label: "Day End Report",                       link: "/day-end-report",                        roles: ["admin", "manager"] },
      { menuKey: "Bill Series Report",                   label: "Bill Series Report",                   link: "/billseriesreport",                      roles: ["admin", "user", "manager"] },
      { menuKey: "Documents List",                       label: "Documents List",                       link: "/documents-list",                        roles: ["user", "admin", "WB"] },
    ],
  },

  // -- Accounting -----------------------------------------------------------
  {
    menuKey: "Accounting", label: "Accounting", icon: AccountBalance, color: "#00695C", link: "",
    roles: ["admin", "manager"], hasSubmenu: true,
    submenu: [
      // Setup & masters
      { menuKey: "Accounting Setup",        label: "Accounting Setup",        link: "/accounting/setup",                 roles: ["admin"] },
      { menuKey: "Ledger Accounts",         label: "Ledger Accounts",         link: "/accounting/ledger-accounts",       roles: ["admin"] },
      { menuKey: "Expense Head Management", label: "Expense Head Management", link: "/expense-head-management",          roles: ["admin"] },
      { menuKey: "Financial Year Setup",    label: "Financial Year Setup",    link: "/financialyearpage",                roles: ["admin", "franchiseeuser"] },
      // Transactions
      { menuKey: "Receipt Entry",           label: "Receipt Entry",           link: "/accounting/receipt-entry",         roles: ["admin", "manager"] },
      { menuKey: "Payment Entry",           label: "Payment Entry",           link: "/accounting/payment-entry",         roles: ["admin", "manager"] },
      { menuKey: "Branch Monthly Expense",  label: "Branch Monthly Expense",  link: "/branch-monthly-expense",           roles: ["admin", "manager"] },
      { menuKey: "Shop Expense Report",     label: "Shop Expense Report",     link: "/shop-expense-report",              roles: ["admin", "manager"] },
      { menuKey: "Inter-Branch Transfer",   label: "Inter-Branch Transfer",   link: "/accounting/inter-branch-transfer", roles: ["admin", "manager"] },
      // Reports
      { menuKey: "Trial Balance",           label: "Trial Balance",           link: "/accounting/trial-balance",         roles: ["admin", "manager"] },
      { menuKey: "Ledger Statement",        label: "Ledger Statement",        link: "/accounting/ledger-statement",      roles: ["admin", "manager"] },
      { menuKey: "Profit & Loss",           label: "Profit & Loss",           link: "/accounting/profit-loss",           roles: ["admin", "manager"] },
      { menuKey: "Balance Sheet",           label: "Balance Sheet",           link: "/accounting/balance-sheet",         roles: ["admin", "manager"] },
      { menuKey: "Cash Flow",               label: "Cash Flow",               link: "/accounting/cash-flow",             roles: ["admin", "manager"] },
      { menuKey: "Customer Statement",      label: "Customer Statement",      link: "/accounting/customer-statement",    roles: ["admin", "manager"] },
      { menuKey: "Supplier Statement",      label: "Supplier Statement",      link: "/accounting/supplier-statement",    roles: ["admin", "manager"] },
      { menuKey: "Customer Aging",          label: "Customer Aging",          link: "/accounting/customer-aging",        roles: ["admin", "manager"] },
      { menuKey: "Supplier Aging",          label: "Supplier Aging",          link: "/accounting/supplier-aging",        roles: ["admin", "manager"] },
      { menuKey: "Bank Reconciliation",     label: "Bank Reconciliation",     link: "/accounting/bank-reconciliation",   roles: ["admin", "manager"] },
      { menuKey: "Inventory Ledger",        label: "Inventory Ledger",        link: "/accounting/inventory-ledger",      roles: ["admin", "manager"] },
      { menuKey: "Stock Valuation",         label: "Stock Valuation",         link: "/accounting/stock-valuation",       roles: ["admin", "manager"] },
      // Operations
      { menuKey: "Period Closing",          label: "Period Closing",          link: "/accounting/period-closing",        roles: ["admin"] },
      { menuKey: "Budget Manager",          label: "Budget Manager",          link: "/accounting/budget-manager",        roles: ["admin", "manager"] },
      { menuKey: "Budget vs Actual",        label: "Budget vs Actual",        link: "/accounting/budget-vs-actual",      roles: ["admin", "manager"] },
    ],
  },

  // -- Franchise Management -------------------------------------------------
  {
    menuKey: "Franchise Management", label: "Franchise", icon: Business, color: "#6A1B9A", link: "",
    roles: ["admin", "system-admin"], hasSubmenu: true,
    submenu: [
      { menuKey: "Franchise Master",         label: "Franchise Master",  link: "/franchise-master",          roles: ["admin", "system-admin"] },
      { menuKey: "Event Monitor",            label: "Event Monitor",     link: "/event-monitor",             roles: ["admin", "system-admin"], icon: Hub },
      { menuKey: "Master Sync",              label: "Master Sync",       link: "/master-sync",               roles: ["admin", "system-admin"] },
      { menuKey: "Franchise Stock Transfer", label: "Stock Transfer",    link: "/franchise-stock-transfer",  roles: ["admin", "system-admin"] },
      { menuKey: "Transfer Config",          label: "Transfer Config",   link: "/franchise-transfer-config", roles: ["admin", "system-admin"] },
      { menuKey: "Franchise Migration",      label: "Migration Utility", link: "/franchise-migration",       roles: ["admin", "system-admin"] },
      { menuKey: "Franchise Users",          label: "Franchise Users",   link: "/franchise-users",           roles: ["admin", "system-admin"] },
    ],
  },

  // -- Tools & Design -------------------------------------------------------
  {
    menuKey: "Tools", label: "Tools & Design", icon: Build, color: "#EF6C00", link: "",
    roles: ["user", "admin", "manager", "WB"], hasSubmenu: true,
    submenu: [
      { menuKey: "Invoice Designer",   label: "Invoice Designer",   link: "/invoicedesigner",    roles: ["user", "admin", "manager"] },
      { menuKey: "Workflow Designer",  label: "Workflow Designer",  link: "/bpmn-editorr",       roles: ["user", "admin", "manager"] },
      { menuKey: "Workflow Instances", label: "Workflow Instances", link: "/workflow-instances", roles: ["user", "admin", "manager"] },
      { menuKey: "Download",           label: "Download",           link: "/download",           roles: ["user", "manager", "admin", "WB"] },
      { menuKey: "Upload",             label: "Upload",             link: "/uploadpage",         roles: ["admin"] },
    ],
  },

  // -- Support & Legal ------------------------------------------------------
  {
    menuKey: "Support & Legal", label: "Support & Legal", icon: HelpOutline, color: "#33691E", link: "",
    roles: ["user", "admin", "manager"], hasSubmenu: true,
    submenu: [
      { menuKey: "Help",               label: "Help",               link: "/help",                 roles: ["user", "admin", "manager"] },
      { menuKey: "About",              label: "About",              link: "/about",                roles: ["user", "admin", "manager"] },
      { menuKey: "Terms & Conditions", label: "Terms & Conditions", link: "/terms-and-conditions", roles: ["user", "admin", "manager"] },
      { menuKey: "Privacy Policy",     label: "Privacy Policy",     link: "/privacy-policy",       roles: ["user", "admin", "manager"] },
      { menuKey: "Refund Policy",      label: "Refund Policy",      link: "/refund-policy",        roles: ["user", "admin", "manager"] },
    ],
  },
];

// Section identity for the flat (non-grouped) top-level entries.
export const TOP_LEVEL_SECTION = "Dashboard & Intelligence";
export const TOP_LEVEL_COLOR = "#1565C0";
export const TOP_LEVEL_ICON = Dashboard;

/**
 * Flattens MENU_TREE into navigable leaves, one per route. Each leaf carries
 * the section it belongs to, so search results and the menu map can group and
 * colour them.
 */
export const flattenMenu = () => {
  const leaves = [];
  MENU_TREE.forEach((item) => {
    if (item.hasSubmenu) {
      item.submenu.forEach((sub) =>
        leaves.push({
          menuKey: sub.menuKey,
          label: sub.label,
          link: sub.link,
          roles: sub.roles,
          parentKey: item.menuKey,
          parentRoles: item.roles,
          section: item.label,
          sectionIcon: item.icon,
          sectionColor: item.color,
        })
      );
    } else {
      leaves.push({
        menuKey: item.menuKey,
        label: item.label,
        link: item.link,
        roles: item.roles,
        parentKey: null,
        parentRoles: item.roles,
        section: TOP_LEVEL_SECTION,
        sectionIcon: item.icon,
        sectionColor: item.color || TOP_LEVEL_COLOR,
      });
    }
  });
  return leaves;
};

/** Sections in tree order, each with its leaves - used by the menu map page. */
export const menuSections = () => {
  const sections = [];
  const topLevel = {
    key: "__top__",
    title: TOP_LEVEL_SECTION,
    icon: TOP_LEVEL_ICON,
    color: TOP_LEVEL_COLOR,
    items: [],
  };
  MENU_TREE.forEach((item) => {
    if (item.hasSubmenu) {
      sections.push({
        key: item.menuKey,
        title: item.label,
        icon: item.icon,
        color: item.color,
        parentRoles: item.roles,
        items: item.submenu,
      });
    } else {
      topLevel.items.push(item);
    }
  });
  return topLevel.items.length
    ? [{ ...topLevel, parentRoles: [] }, ...sections]
    : sections;
};
