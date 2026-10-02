// Content for the public weighbridge pages (/weighbridge-software). Kept apart from the layout so
// the feature list, comparison and roadmap can be edited without touching the JSX.
//
// Everything listed under FEATURES is in the shipped product: the Slint desktop app
// (weighbridge-slint/) plus the web admin's Weighbridge screens. Anything that is not built yet
// belongs in COMPARISON with ours: "roadmap" and in ROADMAP, never in FEATURES.

export const DOWNLOAD_URL = "/api/updates/weighbridge/download";

export const HERO_POINTS = [
  "Reads any indicator over COM port or network",
  "Keeps weighing when the internet is down",
  "Every weighing, photo and rate in your web dashboard",
];

export const FEATURES = [
  {
    key: "indicator",
    title: "Live weight from any indicator",
    text:
      "Serial (COM) or network (TCP/IP), continuous or polled output. Ready-made settings for common " +
      "indicator formats, plus a raw data monitor to set up a new model on site.",
  },
  {
    key: "charge",
    title: "Charges worked out for you",
    text:
      "Rates per wheel type are set from the web. A return weighing of a paid first weighing is free, " +
      "saved tare weights give the net weight at once, and the operator cannot edit the amount.",
  },
  {
    key: "offline",
    title: "Works offline",
    text:
      "Every weighing is saved on the PC first and uploaded when the connection is back. The header " +
      "shows what is waiting, and the web admin can ask a PC to send a day again.",
  },
  {
    key: "print",
    title: "Prints on the printer you have",
    text:
      "A5, 80 mm receipt or dot-matrix (plain text), with a PDF copy of every voucher kept on the PC. " +
      "Voucher numbers carry on from the branch's last number, and any voucher can be reprinted.",
  },
  {
    key: "camera",
    title: "Photo of every weighing",
    text:
      "A USB camera or an IP camera (Hikvision, Dahua snapshot address) takes a photo when the weight " +
      "is saved. Keep it on the PC, upload it, or print it on the voucher.",
  },
  {
    key: "vehicle",
    title: "Knows your vehicles",
    text:
      "Vehicle number suggestions, the vehicle's previous weighings on screen, and a wheel type that " +
      "is locked once set, so it can only be changed from the web.",
  },
  {
    key: "control",
    title: "Controlled from the web",
    text:
      "Settings lock after setup and open only when you allow it from Weighbridge PCs. Rates, " +
      "developer tools and a closed weighing's second weight are also opened from the web.",
  },
  {
    key: "reports",
    title: "Reports on the PC and online",
    text:
      "Daily report with totals and CSV export on the PC. Online: every weighing with its photo, " +
      "bridge activity counts and usage summaries.",
  },
  {
    key: "updates",
    title: "Installs in a minute, updates itself",
    text:
      "One installer for Windows 10 and 11, no admin rights needed. Fits 1024x768 screens, runs over " +
      "Remote Desktop, and installs new versions in the background.",
  },
  {
    key: "branches",
    title: "One site or many",
    text:
      "Each weighbridge is a branch with its own vouchers and rates. Add operator logins, choose which " +
      "branches they can use, and see every site from one dashboard.",
  },
  {
    key: "erp",
    title: "Grows into a full ERP",
    text:
      "The weighbridge is part of TradeLink247. Start with the weighbridge only and add billing, " +
      "inventory and accounts later, on the same login and data.",
  },
  {
    key: "data",
    title: "Your data stays yours",
    text:
      "Each company gets its own database. Settings are copied to the server, so a replacement PC is " +
      "set up with Fetch from server.",
  },
];

// ours: true = built, "partial" = part of it is built, "roadmap" = not built yet.
// typical: what the leading international weighbridge packages commonly offer.
export const COMPARISON = [
  { feature: "Live weight from serial and network indicators", ours: true, typical: true },
  { feature: "Indicator presets and a raw data monitor", ours: true, typical: true },
  { feature: "First and second weighing, stored tare weights", ours: true, typical: true },
  { feature: "Automatic charge by vehicle type, free return trip", ours: true, typical: "partial" },
  { feature: "Keeps working offline, syncs when back online", ours: true, typical: "partial" },
  { feature: "Cloud dashboard across all sites, no server to run", ours: true, typical: "partial" },
  { feature: "Camera photo with every weighing", ours: true, typical: true },
  { feature: "A5, thermal and dot-matrix tickets with PDF copy", ours: true, typical: true },
  { feature: "Settings locked and opened from the web", ours: true, typical: "partial" },
  { feature: "Automatic updates", ours: true, typical: "partial" },
  { feature: "Built-in ERP: billing, inventory, accounts", ours: true, typical: "partial" },
  { feature: "Customer, haulier and material lists with credit accounts", ours: "roadmap", typical: true },
  { feature: "Number plate recognition (ANPR)", ours: "roadmap", typical: true },
  { feature: "Unattended self-service with RFID, card or QR", ours: "roadmap", typical: true },
  { feature: "Boom barrier and traffic light control", ours: "roadmap", typical: true },
  { feature: "Several weighbridges at one site", ours: "roadmap", typical: true },
  { feature: "Orders and contracts with target quantities", ours: "roadmap", typical: true },
  { feature: "Axle weighing and overload alerts", ours: "roadmap", typical: true },
  { feature: "Tickets sent by SMS, WhatsApp or email", ours: "roadmap", typical: "partial" },
  { feature: "QR code on the ticket to check it is genuine", ours: "roadmap", typical: "partial" },
  { feature: "Tamper-evident audit trail for legal-for-trade use", ours: "roadmap", typical: true },
  { feature: "Open API and webhooks", ours: "roadmap", typical: "partial" },
];

export const ROADMAP = [
  {
    stage: "Next",
    items: [
      {
        title: "Number plate recognition (ANPR)",
        text: "Read the vehicle number from the camera and fill it in, with the plate photo kept on the voucher.",
      },
      {
        title: "Digital tickets",
        text: "Send the voucher to the driver or customer by SMS, WhatsApp or email, with a QR code to check it.",
      },
      {
        title: "Customer, haulier and material lists",
        text: "Pick from lists instead of typing, with weighings billed to customer accounts and credit limits.",
      },
    ],
  },
  {
    stage: "Planned",
    items: [
      {
        title: "Several weighbridges per site",
        text: "Two or more PCs at one branch, each with its own voucher series.",
      },
      {
        title: "Orders and contracts",
        text: "Set a target quantity per order and see what has been delivered against it.",
      },
      {
        title: "Audit trail",
        text: "A tamper-evident log of every change and reprint, for legal-for-trade inspections.",
      },
      {
        title: "Open API and webhooks",
        text: "Send each weighing to your own systems as it happens.",
      },
    ],
  },
  {
    stage: "Exploring",
    items: [
      {
        title: "Unattended weighing",
        text: "RFID, card or QR self-service at a kiosk, so drivers weigh without an operator.",
      },
      {
        title: "Barriers and traffic lights",
        text: "Open the boom barrier and switch the lights only when the vehicle is on the bridge and weighed.",
      },
      {
        title: "Axle weighing and overload alerts",
        text: "Weigh axle by axle and warn when a vehicle is over its legal limit.",
      },
    ],
  },
];

export const SCREENSHOTS = {
  app: [
    { src: "/weighbridge-site/app-weighing.png", title: "Weighing", caption: "Live weight, the vehicle's previous weighings, and the charge worked out (here a paid return)." },
    { src: "/weighbridge-site/app-report.png", title: "Daily report", caption: "Weighings between two times, totals, upload status, reprint and CSV export." },
    { src: "/weighbridge-site/app-tares.png", title: "Tare weights", caption: "Save an empty vehicle's weight once and use it for every loaded weighing." },
    { src: "/weighbridge-site/app-rates.png", title: "Rates", caption: "Rates per wheel type, set from the web and pulled by every PC." },
    { src: "/weighbridge-site/app-settings-indicator.png", title: "Indicator setup", caption: "COM port or network, presets, and a raw data monitor to read any indicator." },
    { src: "/weighbridge-site/app-settings-printing.png", title: "Printing", caption: "A5, 80 mm receipt or dot-matrix, with a PDF copy of every voucher." },
  ],
  web: [
    { src: "/weighbridge-site/web-entries.png", title: "Weighings online", caption: "Every weighing from every site, with its photo, and the option to reopen one." },
    { src: "/weighbridge-site/web-pcs.png", title: "Weighbridge PCs", caption: "Each PC's version and last check-in; open Settings or Rates for one PC." },
    { src: "/weighbridge-site/web-rates.png", title: "Rates from the web", caption: "Change a rate once and every PC at the branch picks it up within a minute." },
  ],
};

export const SETUP_STEPS = [
  { title: "Sign up", text: "Choose Weighbridge only. Your account opens with just the weighbridge screens." },
  { title: "Add your site", text: "Create a branch for each weighbridge and set your rates per wheel type." },
  { title: "Install on the weighbridge PC", text: "Download the installer, enter this server's address and sign in." },
  { title: "Connect the indicator", text: "Pick a preset or set the format, choose the printer, and start weighing." },
];
