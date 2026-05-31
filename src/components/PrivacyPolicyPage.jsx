import React from "react";
import { Box, Typography, Paper, Divider, Alert, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";

const Section = ({ title, children }) => (
  <Box sx={{ mb: 4 }}>
    <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, color: "#0b3a75" }}>
      {title}
    </Typography>
    {children}
  </Box>
);

const Para = ({ children }) => (
  <Typography variant="body2" paragraph sx={{ color: "#333", lineHeight: 1.8 }}>
    {children}
  </Typography>
);

const ListItem = ({ children }) => (
  <Typography variant="body2" sx={{ color: "#333", lineHeight: 1.8, mb: 0.5, display: "list-item", ml: 2 }}>
    {children}
  </Typography>
);

const PrivacyPolicyPage = () => {
  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Paper elevation={3} sx={{ p: 5, maxWidth: 860 }}>

        {/* Header */}
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 800, color: "#0b3a75" }}>
          Privacy Policy
        </Typography>
        <Typography variant="body2" sx={{ color: "#888", mb: 1 }}>
          Effective date: June 2025 &nbsp;|&nbsp; Platform: tradelink247.com
        </Typography>
        <Divider sx={{ mb: 4 }} />

        <Para>
          This Privacy Policy describes how <strong>St Marys Weigh Bridge</strong> and its affiliates
          (collectively "St Marys Weigh Bridge", "we", "our", "us") collect, use, share, protect, and
          otherwise process your information and personal data through our website{" "}
          <strong>https://www.tradelink247.com</strong> and the TradeLink247 POS application
          (hereinafter referred to as "Platform").
        </Para>
        <Para>
          We do not offer any product or service under this Platform outside India, and your personal
          data will primarily be stored and processed in India. By visiting this Platform, providing
          your information, or availing any product or service offered on the Platform, you expressly
          agree to be bound by the terms and conditions of this Privacy Policy, the Terms of Use, and
          the applicable service terms and conditions, and agree to be governed by the laws of India
          including but not limited to the laws applicable to data protection and privacy.
        </Para>

        <Alert severity="info" sx={{ mb: 4 }}>
          <strong>In plain terms:</strong> We collect only the information needed to run your business
          account. We do not sell your data. Your business data (sales, inventory, customers) belongs
          to you and is never used for advertising or shared with third parties without your consent.
        </Alert>

        <Divider sx={{ mb: 4 }} />

        <Section title="1. Information We Collect">
          <Para>
            We collect your personal data when you use our Platform, services, or otherwise interact
            with us during the course of our relationship. The categories of data we collect include:
          </Para>

          <Table size="small" sx={{ mb: 2, border: "1px solid #e0e0e0" }}>
            <TableHead>
              <TableRow sx={{ background: "#f5f7fa" }}>
                <TableCell sx={{ fontWeight: 700, width: "35%" }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Examples</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[
                ["Account information",    "Name, email address, phone number, company name, registered address"],
                ["Authentication data",    "Username, hashed password, login timestamps, session tokens"],
                ["Subscription & billing", "Billing address, payment method details (processed via PCI-compliant gateway — we do not store card numbers)"],
                ["Business data",          "Sales records, inventory items, purchase orders, stock transfers, vouchers, customer mobile numbers entered at POS"],
                ["Usage data",             "Pages visited, features used, API calls, error logs, browser/OS type"],
                ["Device information",     "IP address, device type, operating system, POS terminal identifier"],
                ["Communications",         "Support tickets, emails, chat messages sent to us"],
              ].map(([k, v]) => (
                <TableRow key={k}>
                  <TableCell sx={{ fontWeight: 600, color: "#555", verticalAlign: "top" }}>{k}</TableCell>
                  <TableCell sx={{ color: "#333" }}>{v}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Para>
            Some sensitive personal data (such as payment instrument information) may be collected
            with your consent and is handled in accordance with applicable law. You always have the
            option not to provide certain information by choosing not to use a particular feature.
          </Para>
        </Section>

        <Section title="2. How We Use Your Information">
          <Para>
            We use the personal data we collect for the following purposes:
          </Para>
          <Box component="ul" sx={{ pl: 0, listStyle: "disc" }}>
            <ListItem>To create and manage your account and provide the Services you have subscribed to</ListItem>
            <ListItem>To process subscription payments and send billing receipts</ListItem>
            <ListItem>To provide customer support and respond to your queries</ListItem>
            <ListItem>To send service-related notifications (maintenance windows, feature updates, policy changes)</ListItem>
            <ListItem>To monitor Platform performance, diagnose technical issues, and improve our Services</ListItem>
            <ListItem>To detect and prevent fraud, abuse, and security breaches</ListItem>
            <ListItem>To comply with legal obligations and enforce our Terms of Use</ListItem>
            <ListItem>To analyse usage patterns in aggregate, anonymised form to improve product features</ListItem>
          </Box>
          <Para>
            To the extent we use your personal data for marketing communications, we will provide you
            with the ability to opt out. We will not send unsolicited marketing emails without your
            prior consent.
          </Para>
        </Section>

        <Section title="3. Business Data — Your Data Stays Yours">
          <Para>
            All business data you create or upload on the Platform — including sales records, inventory,
            customer information, purchase orders, and financial reports — belongs to you. We act solely
            as a <strong>data processor</strong> on your behalf.
          </Para>
          <Box component="ul" sx={{ pl: 0, listStyle: "disc" }}>
            <ListItem>We will not use your business data for advertising or profiling</ListItem>
            <ListItem>We will not sell, rent, or share your business data with third parties for commercial purposes</ListItem>
            <ListItem>We access your business data only to provide the Services or when required by law</ListItem>
            <ListItem>
              After subscription cancellation, your data remains accessible in read-only mode for
              3 months, after which it is permanently deleted. See our Refund &amp; Cancellation
              Policy for the full timeline.
            </ListItem>
          </Box>
        </Section>

        <Section title="4. Sharing of Information">
          <Para>
            We may share your personal data in the following limited circumstances:
          </Para>
          <Box component="ul" sx={{ pl: 0, listStyle: "disc" }}>
            <ListItem>
              <strong>Service providers:</strong> Third-party vendors who assist us in operating the
              Platform (cloud hosting, payment processing, email delivery). These vendors are
              contractually bound to process data only on our instructions and in accordance with this
              Privacy Policy.
            </ListItem>
            <ListItem>
              <strong>Payment gateways:</strong> When you pay via UPI, card, or net banking, your
              payment details are processed by our payment gateway partner (PhonePe / Razorpay). We
              do not store your full card or bank account details.
            </ListItem>
            <ListItem>
              <strong>Legal compliance:</strong> We may disclose personal data to government agencies
              or law enforcement if required to do so by law, court order, or in good faith belief that
              such disclosure is necessary to comply with legal obligations or protect our rights.
            </ListItem>
            <ListItem>
              <strong>Business transfers:</strong> In the event of a merger, acquisition, or sale of
              all or part of our business, your data may be transferred to the acquiring entity.
              We will notify you before such a transfer and the acquirer will be bound by this
              Privacy Policy.
            </ListItem>
          </Box>
          <Para>
            We do not sell, trade, or otherwise transfer your personally identifiable information to
            third parties for commercial or marketing purposes.
          </Para>
        </Section>

        <Section title="5. Cookies and Tracking">
          <Para>
            We use cookies and similar technologies on the web Platform to:
          </Para>
          <Box component="ul" sx={{ pl: 0, listStyle: "disc" }}>
            <ListItem>Keep you logged in (session cookies)</ListItem>
            <ListItem>Remember your preferences (e.g. language, selected branch)</ListItem>
            <ListItem>Analyse usage patterns in aggregate to improve the product</ListItem>
          </Box>
          <Para>
            We do not use third-party advertising cookies. The TradeLink247 POS desktop application
            (Electron) does not use browser cookies; session data is stored locally on the device.
          </Para>
          <Para>
            You may disable cookies in your browser settings, but this may affect the functionality
            of the web Platform.
          </Para>
        </Section>

        <Section title="6. Data Security">
          <Para>
            We adopt reasonable and appropriate technical and organisational security measures to
            protect your personal data from unauthorised access, disclosure, alteration, or
            destruction. These include:
          </Para>
          <Box component="ul" sx={{ pl: 0, listStyle: "disc" }}>
            <ListItem>HTTPS/TLS encryption for all data in transit</ListItem>
            <ListItem>Passwords stored using industry-standard hashing (bcrypt)</ListItem>
            <ListItem>JWT-based authentication with token expiry</ListItem>
            <ListItem>Role-based access control — users can only access data permitted by their role</ListItem>
            <ListItem>Regular backups of all tenant databases</ListItem>
            <ListItem>Server-side audit logs for sensitive operations</ListItem>
          </Box>
          <Para>
            However, the transmission of information over the internet cannot be guaranteed as
            completely secure. By using the Platform, you acknowledge and accept the inherent security
            implications of data transmission over the internet. You are responsible for maintaining
            the confidentiality of your login credentials and for any activity that occurs under your
            account.
          </Para>
          <Para>
            If you suspect unauthorised access to your account, please contact us immediately and
            change your password. We will never ask you for your password via email or phone.
          </Para>
        </Section>

        <Section title="7. Data Retention">
          <Para>
            We retain your personal data for as long as your account is active or as needed to provide
            the Services, comply with our legal obligations, resolve disputes, and enforce our
            agreements.
          </Para>

          <Table size="small" sx={{ mb: 2, border: "1px solid #e0e0e0" }}>
            <TableHead>
              <TableRow sx={{ background: "#f5f7fa" }}>
                <TableCell sx={{ fontWeight: 700, width: "35%" }}>Data type</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Retention period</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[
                ["Account & profile data",   "Duration of subscription + 3 months after cancellation"],
                ["Business data (sales, inventory, etc.)", "Duration of subscription + 3 months after cancellation, then permanently deleted"],
                ["Billing records",          "7 years (as required by Indian tax and accounting laws)"],
                ["Server & security logs",   "90 days rolling"],
                ["Support communications",   "2 years from last interaction"],
              ].map(([k, v]) => (
                <TableRow key={k}>
                  <TableCell sx={{ fontWeight: 600, color: "#555", verticalAlign: "top" }}>{k}</TableCell>
                  <TableCell sx={{ color: "#333" }}>{v}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Para>
            We may retain anonymised, aggregated data (with no personally identifiable information)
            for longer periods for analytical and research purposes.
          </Para>
        </Section>

        <Section title="8. Your Rights">
          <Para>
            As a user of our Platform, you have the following rights with respect to your personal data:
          </Para>
          <Box component="ul" sx={{ pl: 0, listStyle: "disc" }}>
            <ListItem>
              <strong>Access:</strong> You may request a copy of the personal data we hold about you.
            </ListItem>
            <ListItem>
              <strong>Correction:</strong> You may update or correct inaccurate personal data directly
              through your account profile, or by contacting us.
            </ListItem>
            <ListItem>
              <strong>Data portability:</strong> You may export your business data (sales, inventory,
              reports) in CSV/Excel format at any time from within the Platform.
            </ListItem>
            <ListItem>
              <strong>Deletion:</strong> You may request deletion of your account and personal data
              by contacting us. Please note that we may retain certain data as required by law
              (e.g. billing records for tax compliance).
            </ListItem>
            <ListItem>
              <strong>Withdrawal of consent:</strong> Where processing is based on consent, you may
              withdraw your consent at any time. Withdrawal will not affect the lawfulness of
              processing before withdrawal.
            </ListItem>
            <ListItem>
              <strong>Opt-out of marketing:</strong> You may opt out of marketing communications at
              any time by clicking "Unsubscribe" in any email or by contacting us.
            </ListItem>
          </Box>
          <Para>
            To exercise any of the above rights, please write to our Grievance Officer using the
            contact details below. We will respond within <strong>30 days</strong> of receiving
            your request.
          </Para>
        </Section>

        <Section title="9. Third-Party Links">
          <Para>
            The Platform may contain links to third-party websites or services (e.g. PhonePe payment
            portal, document help pages). We are not responsible for the privacy practices or content
            of those third-party sites. We encourage you to read the privacy policies of any
            third-party sites you visit.
          </Para>
        </Section>

        <Section title="10. Children's Privacy">
          <Para>
            The Platform is intended for use by businesses and their authorised personnel. We do not
            knowingly collect personal data from individuals under the age of 18. If you believe a
            minor has provided us with personal data, please contact us and we will delete it promptly.
          </Para>
        </Section>

        <Section title="11. Changes to This Privacy Policy">
          <Para>
            We may update this Privacy Policy from time to time to reflect changes in our practices,
            technology, legal requirements, or other factors. We will notify you of significant
            changes by:
          </Para>
          <Box component="ul" sx={{ pl: 0, listStyle: "disc" }}>
            <ListItem>Sending an email to the address associated with your account</ListItem>
            <ListItem>Displaying a prominent notice within the Platform</ListItem>
          </Box>
          <Para>
            Please check this page periodically. Continued use of the Platform after the effective
            date of any changes constitutes your acceptance of the updated Privacy Policy.
          </Para>
        </Section>

        <Section title="12. Grievance Officer">
          <Para>
            In accordance with the Information Technology Act, 2000 and the rules made thereunder,
            the name and contact details of the Grievance Officer are provided below. Any grievances
            or concerns regarding the processing of your personal data must be addressed to:
          </Para>
          <Box sx={{ background: "#f5f7fa", border: "1px solid #e0e0e0", borderRadius: 1, p: 2.5, mt: 1 }}>
            <Typography variant="body2" sx={{ lineHeight: 2 }}>
              <strong>Grievance Officer:</strong> Regy George<br />
              <strong>Designation:</strong> Proprietor<br />
              <strong>Company:</strong> St Marys Weigh Bridge<br />
              <strong>Address:</strong> Kottarakkara, Kerala, India<br />
              <strong>Website:</strong> https://www.tradelink247.com<br />
              <strong>Support hours:</strong> Monday – Friday, 9:00 – 18:00 IST
            </Typography>
          </Box>
          <Para sx={{ mt: 2 }}>
            We will acknowledge your grievance within <strong>48 hours</strong> and resolve it
            within <strong>30 days</strong> of receipt.
          </Para>
        </Section>

        <Divider sx={{ mt: 4, mb: 2 }} />
        <Typography variant="caption" sx={{ color: "#aaa" }}>
          Last updated: June 2025. This Privacy Policy supersedes all previous versions.
        </Typography>

      </Paper>
    </Box>
  );
};

export default PrivacyPolicyPage;
