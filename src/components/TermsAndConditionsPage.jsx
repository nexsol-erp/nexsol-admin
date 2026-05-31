import React from "react";
import { Box, Typography, Paper, Divider } from "@mui/material";

const Section = ({ title, children }) => (
  <Box sx={{ mb: 3 }}>
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

const TermsAndConditionsPage = () => {
  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Paper elevation={3} sx={{ p: 5, maxWidth: 860 }}>

        {/* Header */}
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 800, color: "#0b3a75" }}>
          Terms &amp; Conditions
        </Typography>
        <Typography variant="body2" sx={{ color: "#888", mb: 1 }}>
          Effective date: June 2025 &nbsp;|&nbsp; Platform: tradelink247.com
        </Typography>
        <Divider sx={{ mb: 4 }} />

        <Para>
          This document is an electronic record in terms of the Information Technology Act, 2000 and rules
          thereunder as applicable, and the amended provisions pertaining to electronic records in various
          statutes as amended by the Information Technology Act, 2000. This electronic record is generated
          by a computer system and does not require any physical or digital signatures.
        </Para>
        <Para>
          This document is published in accordance with the provisions of Rule 3(1) of the Information
          Technology (Intermediaries Guidelines) Rules, 2011, which require publishing the rules and
          regulations, privacy policy, and Terms of Use for access or usage of the domain name{" "}
          <strong>https://www.tradelink247.com</strong> ("Platform"), including the related web application
          (hereinafter referred to as "Platform").
        </Para>
        <Para>
          The Platform is owned and operated by <strong>St Marys Weigh Bridge</strong>, a company
          incorporated under the Companies Act, 1956, with its registered office at Kottarakkara
          (hereinafter referred to as "Platform Owner", "we", "us", "our").
        </Para>
        <Para>
          Your use of the Platform and services is governed by the following Terms of Use. By mere use of
          the Platform, you shall be contracting with the Platform Owner and these terms and conditions
          constitute your binding obligations. These Terms of Use can be modified at any time without
          assigning any reason. It is your responsibility to periodically review these Terms of Use.
        </Para>

        <Divider sx={{ my: 3 }} />

        <Section title="1. Acceptance of Terms">
          <Para>
            ACCESSING, BROWSING, OR OTHERWISE USING THE PLATFORM INDICATES YOUR AGREEMENT TO ALL
            TERMS AND CONDITIONS UNDER THESE TERMS OF USE. PLEASE READ THE TERMS OF USE CAREFULLY
            BEFORE PROCEEDING.
          </Para>
          <Para>
            For the purpose of these Terms of Use, wherever the context so requires, "you", "your", or
            "user" shall mean any natural or legal person who has agreed to become a user/subscriber
            on the Platform.
          </Para>
        </Section>

        <Section title="2. User Obligations">
          <Box component="ul" sx={{ pl: 0, listStyle: "disc" }}>
            <ListItem>
              To access and use the Services, you agree to provide true, accurate, and complete
              information during and after registration. You are responsible for all acts done through
              your registered account.
            </ListItem>
            <ListItem>
              Neither we nor any third parties provide any warranty or guarantee as to the accuracy,
              timeliness, performance, completeness, or suitability of the information and materials
              offered on this Platform for any specific purpose. Such information may contain
              inaccuracies or errors, and we expressly exclude liability for any such inaccuracies or
              errors to the fullest extent permitted by law.
            </ListItem>
            <ListItem>
              Your use of our Services and the Platform is solely and entirely at your own risk and
              discretion. You are required to independently assess and ensure that the Services meet
              your requirements.
            </ListItem>
            <ListItem>
              The contents of the Platform and the Services are proprietary to us and are licensed to
              us. You will not have any authority to claim any intellectual property rights, title, or
              interest in its contents.
            </ListItem>
            <ListItem>
              You acknowledge that unauthorised use of the Platform and/or the Services may lead to
              action against you as per these Terms of Use and/or applicable laws.
            </ListItem>
            <ListItem>
              You agree to pay the charges associated with availing the Services as per the
              subscription plan selected by you.
            </ListItem>
            <ListItem>
              You agree not to use the Platform and/or Services for any purpose that is unlawful,
              illegal, or forbidden by these Terms, or Indian or local laws that might apply to you.
            </ListItem>
            <ListItem>
              You understand that upon initiating a transaction for availing the Services, you are
              entering into a legally binding and enforceable contract with the Platform Owner for
              the Services.
            </ListItem>
          </Box>
        </Section>

        <Section title="3. Subscription and Billing">
          <Para>
            The Platform is offered on a <strong>monthly subscription basis</strong>. By subscribing,
            you authorise us to charge the applicable subscription fee on a recurring monthly basis
            using your chosen payment method.
          </Para>
          <Box component="ul" sx={{ pl: 0, listStyle: "disc" }}>
            <ListItem>
              Subscription fees are billed in advance at the beginning of each monthly billing cycle.
            </ListItem>
            <ListItem>
              You may cancel your subscription at any time. Cancellation will take effect at the end
              of the current billing period, and you will not be charged for subsequent periods.
            </ListItem>
            <ListItem>
              Upon cancellation, your account and data will remain accessible for a period of{" "}
              <strong>30 days</strong> from the cancellation date.
            </ListItem>
            <ListItem>
              After cancellation, you may download or export your data for a period of{" "}
              <strong>3 (three) months</strong> from the date of cancellation. After this period,
              your data may be permanently deleted.
            </ListItem>
            <ListItem>
              We reserve the right to modify pricing with <strong>30 days' prior notice</strong>.
              Continued use of the Platform after a price change constitutes your acceptance of the
              new pricing.
            </ListItem>
          </Box>
        </Section>

        <Section title="4. Intellectual Property">
          <Para>
            The contents of the Platform and the Services, including but not limited to the design,
            layout, look, graphics, software, and underlying code, are proprietary to us and are
            protected under applicable intellectual property laws. You are granted a limited,
            non-exclusive, non-transferable licence to use the Platform solely for the purposes of
            your business operations in accordance with these Terms.
          </Para>
        </Section>

        <Section title="5. Data and Privacy">
          <Para>
            Your use of the Platform is also governed by our Privacy Policy, which is incorporated
            herein by reference. By using the Platform, you consent to the collection, use, and
            processing of your data as described in the Privacy Policy.
          </Para>
          <Para>
            You retain ownership of all business data you upload or generate through the Platform
            (including sales records, inventory data, and customer data). We act as a data processor
            on your behalf and will not use your business data for any purpose other than providing
            the Services.
          </Para>
        </Section>

        <Section title="6. Limitation of Liability">
          <Para>
            To the fullest extent permitted by applicable law, the Platform Owner shall not be liable
            for any indirect, incidental, special, consequential, or punitive damages, or any loss of
            profits or revenues, whether incurred directly or indirectly, or any loss of data, use,
            goodwill, or other intangible losses resulting from your use of the Platform or Services.
          </Para>
          <Para>
            Our total aggregate liability to you for any claim arising out of or relating to these
            Terms or the Services shall not exceed the total amount paid by you to us in the three
            (3) months immediately preceding the date of the claim.
          </Para>
        </Section>

        <Section title="7. Indemnification">
          <Para>
            You shall indemnify and hold harmless the Platform Owner, its affiliates, group companies,
            and their respective officers, directors, agents, and employees from any claim, demand,
            or action, including reasonable attorney's fees, made by any third party or penalty
            imposed due to or arising out of your breach of these Terms of Use, Privacy Policy, or
            your violation of any law, rules, or regulations or the rights (including infringement
            of intellectual property rights) of a third party.
          </Para>
        </Section>

        <Section title="8. Force Majeure">
          <Para>
            The parties shall not be liable for any failure to perform an obligation under these Terms
            if performance is prevented or delayed by a force majeure event, including but not limited
            to acts of God, natural disasters, war, government action, or failure of third-party
            infrastructure (internet, cloud services, payment networks).
          </Para>
        </Section>

        <Section title="9. Termination">
          <Para>
            We reserve the right to suspend or terminate your access to the Platform at any time, with
            or without notice, if we believe you have violated these Terms of Use or applicable laws.
            Upon termination for cause, you will not be entitled to a refund of any prepaid fees.
          </Para>
          <Para>
            You may terminate your subscription at any time by following the cancellation procedure
            described in the Subscription and Billing section above.
          </Para>
        </Section>

        <Section title="10. Governing Law and Dispute Resolution">
          <Para>
            These Terms and any dispute or claim relating to them, or their enforceability, shall be
            governed by and construed in accordance with the <strong>laws of India</strong>.
          </Para>
          <Para>
            All disputes arising out of or in connection with these Terms shall be subject to the
            exclusive jurisdiction of the competent courts located in{" "}
            <strong>Kottarakkara, Kerala, India</strong>.
          </Para>
        </Section>

        <Section title="11. Contact Us">
          <Para>
            All concerns or communications relating to these Terms must be communicated to us using
            the contact information provided on this website.
          </Para>
          <Para>
            <strong>Platform Owner:</strong> St Marys Weigh Bridge<br />
            <strong>Website:</strong> https://www.tradelink247.com<br />
            <strong>Support hours:</strong> Monday – Friday, 9:00 – 18:00 IST
          </Para>
        </Section>

        <Divider sx={{ mt: 4, mb: 2 }} />
        <Typography variant="caption" sx={{ color: "#aaa" }}>
          Last updated: June 2025. These Terms of Use supersede all previous versions.
        </Typography>

      </Paper>
    </Box>
  );
};

export default TermsAndConditionsPage;
