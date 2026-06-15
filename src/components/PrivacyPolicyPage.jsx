import React from "react";

const s = {
  page: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    background: "#f5f7fa",
    color: "#4b5563",
    lineHeight: 1.8,
    minHeight: "100vh",
  },
  header: {
    background: "linear-gradient(135deg, #1565C0, #00838F)",
    color: "white",
    padding: "48px 24px 36px",
    textAlign: "center",
  },
  h1: { fontSize: "2rem", fontWeight: 700, marginBottom: 6 },
  headerSub: { fontSize: "0.95rem", opacity: 0.85 },
  main: { maxWidth: 800, margin: "40px auto", padding: "0 20px 60px" },
  updated: { textAlign: "center", color: "#7f8c8d", fontSize: "0.85rem", marginBottom: 32 },
  card: {
    background: "white",
    borderRadius: 12,
    padding: 32,
    marginBottom: 20,
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },
  h2: {
    fontSize: "1.15rem",
    color: "#1565C0",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: "2px solid #e3f2fd",
  },
  p: { marginBottom: 12, fontSize: "0.97rem", color: "#6b7280" },
  ul: { paddingLeft: 20, marginBottom: 12 },
  li: { marginBottom: 6, fontSize: "0.97rem", color: "#6b7280" },
  contactBox: {
    background: "#e3f2fd",
    borderLeft: "4px solid #1565C0",
    borderRadius: "0 8px 8px 0",
    padding: "16px 20px",
    marginTop: 12,
  },
  footer: { textAlign: "center", padding: 24, color: "#95a5a6", fontSize: "0.85rem" },
};

const PrivacyPolicyPage = ({ isPublic = false }) => {
  return (
    <div style={{ ...s.page, marginLeft: isPublic ? 0 : 240, marginTop: isPublic ? 0 : 16 }}>

      <div style={s.header}>
        <h1 style={s.h1}>TradeLink ERP</h1>
        <p style={s.headerSub}>Privacy Policy</p>
      </div>

      <div style={s.main}>
        <p style={s.updated}>Last updated: June 15, 2026</p>

        <div style={s.card}>
          <h2 style={s.h2}>1. Introduction</h2>
          <p style={s.p}>
            <strong>Maple ERP</strong> ("we", "our", or "us") operates the TradeLink ERP mobile
            application (the "App"). This Privacy Policy explains how we collect, use, and protect
            information when you use our App. By using the App, you agree to the practices described
            in this policy.
          </p>
          <p style={s.p}>
            TradeLink ERP is a business-to-business (B2B) application designed for retail and
            wholesale businesses to manage point-of-sale billing, inventory, and sales reporting.
            It is intended for use by authorised business employees only.
          </p>
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>2. Information We Collect</h2>
          <p style={s.p}>We collect only the minimum information necessary to provide the App's functionality:</p>
          <ul style={s.ul}>
            <li style={s.li}><strong>Account credentials</strong> — username and password used to authenticate with your organisation's ERP server.</li>
            <li style={s.li}><strong>Business data</strong> — sales transactions, inventory records, and branch information entered or viewed through the App. This data belongs to your organisation.</li>
            <li style={s.li}><strong>Device information</strong> — device model and OS version, collected only for troubleshooting purposes.</li>
            <li style={s.li}><strong>Bluetooth device identifiers</strong> — MAC address of paired thermal printers, stored locally on your device only.</li>
          </ul>
          <p style={s.p}>We do <strong>not</strong> collect personal information such as your name, email address, location, contacts, photos, or any data unrelated to ERP business operations.</p>
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>3. How We Use Your Information</h2>
          <p style={s.p}>Information collected is used solely to:</p>
          <ul style={s.ul}>
            <li style={s.li}>Authenticate users and maintain secure sessions with the ERP server.</li>
            <li style={s.li}>Display and process business transactions (sales, inventory, reports).</li>
            <li style={s.li}>Connect to and print receipts on Bluetooth thermal printers.</li>
            <li style={s.li}>Improve App stability and fix technical issues.</li>
          </ul>
          <p style={s.p}>We do not use your information for advertising, profiling, or any purpose beyond operating the App.</p>
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>4. Data Storage and Security</h2>
          <ul style={s.ul}>
            <li style={s.li}>Authentication tokens are stored in encrypted secure storage on your device (Android Keystore).</li>
            <li style={s.li}>All communication between the App and the ERP server is encrypted using HTTPS/TLS.</li>
            <li style={s.li}>Business data is stored on your organisation's own servers — we do not operate separate cloud storage for your data.</li>
            <li style={s.li}>Printer settings are stored locally on your device and are never transmitted to external servers.</li>
          </ul>
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>5. Data Sharing</h2>
          <p style={s.p}>
            We do <strong>not</strong> sell, trade, or share your information with third parties.
            Business data entered into the App is transmitted only to your organisation's own ERP server
            (tradelink247.com) as configured by your administrator.
          </p>
          <p style={s.p}>
            We do not use any third-party analytics, advertising SDKs, or data brokers within the App.
          </p>
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>6. Data Retention</h2>
          <p style={s.p}>
            The App stores authentication tokens locally until you log out. All business data resides
            on your organisation's ERP server and is governed by your organisation's own data retention
            policies. We do not independently retain any of your business data.
          </p>
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>7. Children's Privacy</h2>
          <p style={s.p}>
            TradeLink ERP is a professional business application intended for users aged 18 and above.
            We do not knowingly collect any information from minors. If you believe a minor is using
            this App, please contact your organisation's administrator.
          </p>
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>8. Your Rights</h2>
          <p style={s.p}>As a user of the App, you have the right to:</p>
          <ul style={s.ul}>
            <li style={s.li}>Log out at any time, which removes your authentication token from the device.</li>
            <li style={s.li}>Request deletion of your account by contacting your organisation's administrator.</li>
            <li style={s.li}>Access the business data associated with your account through the App's reporting features.</li>
          </ul>
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>9. Changes to This Policy</h2>
          <p style={s.p}>
            We may update this Privacy Policy from time to time. Changes will be posted on this page
            with an updated date. Continued use of the App after changes are posted constitutes
            acceptance of the updated policy.
          </p>
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>10. Contact Us</h2>
          <p style={s.p}>If you have any questions about this Privacy Policy, please contact us:</p>
          <div style={s.contactBox}>
            <p style={s.p}><strong>Maple ERP</strong></p>
            <p style={s.p}>Email: <a href="mailto:support@tradelink247.com">support@tradelink247.com</a></p>
            <p style={{ ...s.p, marginBottom: 0 }}>Website: <a href="https://www.tradelink247.com">www.tradelink247.com</a></p>
          </div>
        </div>
      </div>

      <div style={s.footer}>
        © 2026 Maple ERP. All rights reserved.
      </div>

    </div>
  );
};

export default PrivacyPolicyPage;
