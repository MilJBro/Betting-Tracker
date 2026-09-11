import LegalLayout from '../components/LegalLayout.jsx';

export default function Terms() {
  return (
    <LegalLayout title="Terms of Service" updated="11 September 2026">
      <p>
        These terms govern your use of Betbooks (“Betbooks”, “we”, “us”), a personal betting
        record-keeping and analytics tool available at betbooks.co.uk. By creating an account or
        using the service you agree to these terms. If you do not agree, please don’t use Betbooks.
      </p>

      <h2>1. What Betbooks is — and isn’t</h2>
      <p>
        Betbooks is a tool for logging bets you have placed elsewhere and seeing your own results,
        profit and trends. <strong>Betbooks does not accept bets, take payments for wagers, offer
        odds, or facilitate gambling of any kind.</strong> We are not a bookmaker, betting exchange,
        tipster or gambling operator. Any figures shown are calculated from the information you
        enter and are for your own record-keeping only.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 18 years old (or the legal age for gambling where you live, if higher)
        to use Betbooks. By using the service you confirm that you meet this requirement.
      </p>

      <h2>3. Your account</h2>
      <ul>
        <li>You’re responsible for keeping your login details secure and for all activity under your account.</li>
        <li>Provide accurate information when signing up, and keep it up to date.</li>
        <li>Tell us promptly if you believe your account has been accessed without your permission.</li>
      </ul>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>use Betbooks for anything unlawful, or in breach of the rules of any bookmaker or gambling regulator;</li>
        <li>attempt to disrupt, reverse-engineer, overload or gain unauthorised access to the service;</li>
        <li>upload content that is unlawful, or that infringes someone else’s rights; or</li>
        <li>resell or commercially exploit the service without our written permission.</li>
      </ul>

      <h2>5. Your data</h2>
      <p>
        The bets and settings you enter remain yours. How we handle personal information is
        explained in our <a href="/privacy">Privacy Policy</a>. You can export or delete your data
        as described there.
      </p>

      <h2>6. Paid features</h2>
      <p>
        Some features may be offered as a paid plan. Pricing and what’s included are shown before
        you purchase. Where payments are processed by a third party (such as Stripe), their terms
        also apply. Unless required by law, payments are non-refundable, and you can cancel a
        recurring plan at any time to stop future charges.
      </p>

      <h2>7. Availability and changes</h2>
      <p>
        We aim to keep Betbooks running smoothly but we don’t promise it will always be available,
        uninterrupted or error-free. We may change, suspend or discontinue features, and we may
        update these terms from time to time. If we make material changes we’ll update the date at
        the top of this page and, where appropriate, let you know in the app.
      </p>

      <h2>8. No warranties</h2>
      <p>
        Betbooks is provided “as is” and “as available”, without warranties of any kind, whether
        express or implied. We don’t guarantee that any statistic, projection or calculation is
        accurate, complete or suitable for any purpose. Nothing in Betbooks is betting, financial or
        legal advice.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, Betbooks is not liable for any loss arising from
        gambling, from decisions you make using the service, or for any indirect or consequential
        loss. Nothing in these terms limits liability that cannot be limited by law.
      </p>

      <h2>10. Responsible gambling</h2>
      <p>
        Please gamble responsibly and only with money you can afford to lose. If gambling is
        causing you or someone you know harm, free, confidential help is available from
        {' '}<a href="https://www.begambleaware.org" target="_blank" rel="noreferrer">BeGambleAware</a> and
        {' '}<a href="https://www.gamcare.org.uk" target="_blank" rel="noreferrer">GamCare</a> (0808 8020 133).
      </p>

      <h2>11. Governing law</h2>
      <p>
        These terms are governed by the laws of England and Wales, and the courts of England and
        Wales have exclusive jurisdiction, unless local law where you live requires otherwise.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions about these terms? Email <a href="mailto:support@betbooks.co.uk">support@betbooks.co.uk</a>.
      </p>
    </LegalLayout>
  );
}
