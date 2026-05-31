import React from "react";
import {
  Box, Typography, Paper, Divider, Alert,
  Table, TableBody, TableCell, TableHead, TableRow,
} from "@mui/material";
import CancelIcon from "@mui/icons-material/Cancel";
import DownloadIcon from "@mui/icons-material/Download";
import EventRepeatIcon from "@mui/icons-material/EventRepeat";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

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

const HighlightCard = ({ icon, title, body, color = "#0b3a75" }) => (
  <Box sx={{
    display: "flex", alignItems: "flex-start", gap: 2,
    p: 2.5, mb: 2, border: `1px solid ${color}22`,
    borderLeft: `4px solid ${color}`, borderRadius: 1,
    background: `${color}08`,
  }}>
    <Box sx={{ color, mt: 0.3 }}>{icon}</Box>
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, color, mb: 0.5 }}>{title}</Typography>
      <Typography variant="body2" sx={{ color: "#444", lineHeight: 1.7 }}>{body}</Typography>
    </Box>
  </Box>
);

const RefundPolicyPage = () => {
  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Paper elevation={3} sx={{ p: 5, maxWidth: 860 }}>

        {/* Header */}
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 800, color: "#0b3a75" }}>
          Refund &amp; Cancellation Policy
        </Typography>
        <Typography variant="body2" sx={{ color: "#888", mb: 1 }}>
          Effective date: June 2025 &nbsp;|&nbsp; Platform: tradelink247.com
        </Typography>
        <Divider sx={{ mb: 4 }} />

        {/* Summary alert */}
        <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 4, borderRadius: 1 }}>
          <strong>Summary:</strong> TradeLink247 operates on a monthly subscription model with no
          refunds. You can cancel anytime and your data remains downloadable for 3 months after
          cancellation.
        </Alert>

        {/* Key highlights */}
        <Section title="Key Policy Highlights">
          <HighlightCard
            icon={<EventRepeatIcon />}
            title="Monthly Subscription — No Refunds"
            body="All subscription fees are charged monthly in advance and are non-refundable. This includes partial months, unused features, or early cancellation within a billing period."
            color="#d32f2f"
          />
          <HighlightCard
            icon={<CancelIcon />}
            title="Cancel Anytime"
            body="You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of the current billing month. You will not be charged for subsequent months."
            color="#0b3a75"
          />
          <HighlightCard
            icon={<DownloadIcon />}
            title="Data Access for 3 Months After Cancellation"
            body="After cancellation, your account data (sales, inventory, reports) remains accessible in read-only mode and can be downloaded/exported for a period of 3 months from the cancellation date. After 3 months, data may be permanently deleted."
            color="#2e7d32"
          />
        </Section>

        <Divider sx={{ my: 3 }} />

        <Section title="1. No Refund Policy">
          <Para>
            TradeLink247 does not offer refunds for any subscription fees paid, whether for the
            current billing period or any prior periods. This policy applies to:
          </Para>
          <Box component="ul" sx={{ pl: 0, listStyle: "disc" }}>
            <ListItem>Partial months of unused service after cancellation</ListItem>
            <ListItem>Features or modules not utilised during the subscription period</ListItem>
            <ListItem>Downtime or service interruptions covered under our SLA</ListItem>
            <ListItem>Plan changes or downgrades during the middle of a billing cycle</ListItem>
            <ListItem>Accounts suspended for violation of Terms of Use</ListItem>
          </Box>
          <Para>
            By subscribing to the Platform, you acknowledge and agree that subscription fees are
            earned upon payment and that no refunds will be issued under any circumstances, except as
            required by applicable law.
          </Para>
        </Section>

        <Section title="2. Subscription Model">
          <Para>
            The Platform operates on a <strong>monthly recurring subscription</strong>. The
            subscription fee is charged automatically at the beginning of each billing cycle
            using your registered payment method.
          </Para>

          <Table size="small" sx={{ mb: 2, border: "1px solid #e0e0e0", borderRadius: 1 }}>
            <TableHead>
              <TableRow sx={{ background: "#f5f7fa" }}>
                <TableCell sx={{ fontWeight: 700 }}>Aspect</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[
                ["Billing cycle",        "Monthly (every 30 days from subscription start date)"],
                ["Billing timing",       "Charged in advance at the start of each cycle"],
                ["Payment methods",      "UPI, Credit/Debit card, Net banking"],
                ["Failed payments",      "3 retry attempts; service suspended after repeated failures"],
                ["Price changes",        "30 days' advance notice via email and in-app notification"],
                ["Currency",             "Indian Rupees (INR)"],
              ].map(([k, v]) => (
                <TableRow key={k}>
                  <TableCell sx={{ fontWeight: 600, color: "#555", width: "35%" }}>{k}</TableCell>
                  <TableCell sx={{ color: "#333" }}>{v}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>

        <Section title="3. Cancellation">
          <Para>
            You may cancel your subscription at any time. There are no cancellation fees or
            penalties.
          </Para>
          <Box component="ul" sx={{ pl: 0, listStyle: "disc" }}>
            <ListItem>
              To cancel, go to <strong>Settings → Subscription → Cancel Subscription</strong> within
              your account, or contact our support team.
            </ListItem>
            <ListItem>
              Cancellation takes effect at the <strong>end of the current billing month</strong>.
              You will continue to have full access to the Platform until that date.
            </ListItem>
            <ListItem>
              You will not be charged for any subsequent billing periods after cancellation is
              confirmed.
            </ListItem>
            <ListItem>
              Reactivation is possible at any time within the 3-month data retention window by
              simply subscribing again.
            </ListItem>
          </Box>
        </Section>

        <Section title="4. Data Retention After Cancellation">
          <Para>
            We understand that your business data is important. After cancellation:
          </Para>

          <Table size="small" sx={{ mb: 2, border: "1px solid #e0e0e0", borderRadius: 1 }}>
            <TableHead>
              <TableRow sx={{ background: "#f5f7fa" }}>
                <TableCell sx={{ fontWeight: 700 }}>Period</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>What you can do</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[
                ["Day 1 – 30",    "Full account access, all features active (billing cycle continues until end of period)"],
                ["Day 31 – 90",   "Read-only access — view and download/export all your data (sales, inventory, reports)"],
                ["After Day 90",  "Account and all associated data permanently deleted. This cannot be reversed."],
              ].map(([k, v]) => (
                <TableRow key={k}>
                  <TableCell sx={{ fontWeight: 600, color: "#555", width: "30%" }}>{k}</TableCell>
                  <TableCell sx={{ color: "#333" }}>{v}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Alert severity="warning" sx={{ mt: 1 }}>
            <strong>Important:</strong> Please download all your data before the 90-day window closes.
            We are not liable for any data loss after this period. Data exports include sales history,
            inventory reports, purchase records, and vouchers in CSV/Excel format.
          </Alert>
        </Section>

        <Section title="5. Exceptions">
          <Para>
            We may, at our sole discretion, consider refunds or service credits in the following
            exceptional circumstances:
          </Para>
          <Box component="ul" sx={{ pl: 0, listStyle: "disc" }}>
            <ListItem>
              <strong>Double billing:</strong> If you were charged more than once for the same
              billing period due to a technical error, we will refund the duplicate charge.
            </ListItem>
            <ListItem>
              <strong>Extended downtime:</strong> If the Platform experiences downtime exceeding our
              committed SLA for a given month, you may be eligible for a prorated service credit
              (not a cash refund) for the affected period.
            </ListItem>
          </Box>
          <Para>
            To request a review under these exceptions, contact us within 7 days of the issue with
            transaction details. All decisions are at our sole discretion.
          </Para>
        </Section>

        <Section title="6. Contact Us">
          <Para>
            For billing queries, cancellation assistance, or data export help, please contact us:
          </Para>
          <Para>
            <strong>Platform Owner:</strong> St Marys Weigh Bridge<br />
            <strong>Website:</strong> https://www.tradelink247.com<br />
            <strong>Support hours:</strong> Monday – Friday, 9:00 – 18:00 IST
          </Para>
          <Para>
            All refund/billing disputes must be raised within <strong>7 days</strong> of the
            charge date. Disputes raised after this period will not be considered.
          </Para>
        </Section>

        <Divider sx={{ mt: 4, mb: 2 }} />
        <Typography variant="caption" sx={{ color: "#aaa" }}>
          Last updated: June 2025. This policy supersedes all previous versions and is subject to
          change with 30 days' prior notice to subscribers.
        </Typography>

      </Paper>
    </Box>
  );
};

export default RefundPolicyPage;
