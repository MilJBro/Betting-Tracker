import LegalLayout from '../components/LegalLayout.jsx';

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" updated="11 September 2026">
      <p>
        This policy explains what personal information Betbooks (“we”, “us”) collects, why, and
        what rights you have. Betbooks is a personal betting tracker at betbooks.co.uk. We aim to
        collect as little as possible and never sell your data.
      </p>

      <h2>1. What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your email address and username. Your password is stored only as a secure one-way hash — we never see or keep the plain text.</li>
        <li><strong>The data you enter:</strong> the bets you log (sport, selection, odds, stake, result and similar), your trackers, and your preferences and settings.</li>
        <li><strong>Technical basics:</strong> information needed to run the service securely, such as your login session token stored in your browser.</li>
      </ul>
      <p>We do not ask for or store payment card numbers ourselves — see “Third parties” below.</p>

      <h2>2. How we use it</h2>
      <ul>
        <li>to provide the service — to create your account, save your bets and calculate your stats;</li>
        <li>to keep the service secure and prevent abuse;</li>
        <li>to contact you about your account, such as a password-reset email you request; and</li>
        <li>to fix problems and improve how Betbooks works.</li>
      </ul>
      <p>We do not use your betting data for advertising, and we do not sell it to anyone.</p>

      <h2>3. Legal basis</h2>
      <p>
        Where UK/EU data protection law applies, we process your information to perform our contract
        with you (providing the service), on the basis of our legitimate interest in running and
        securing Betbooks, and to comply with legal obligations.
      </p>

      <h2>4. Cookies and local storage</h2>
      <p>
        Betbooks uses your browser’s local storage to keep you signed in and to remember small
        preferences (like a dismissed reminder). We don’t use third-party advertising or tracking
        cookies.
      </p>

      <h2>5. Third parties</h2>
      <p>We share data only with the providers needed to run the service:</p>
      <ul>
        <li><strong>Hosting:</strong> our application and database are hosted on Render, which stores the data on our behalf.</li>
        <li><strong>Email:</strong> if you request a password reset, the email is sent through our email provider.</li>
        <li><strong>Payments:</strong> if you buy a paid plan, payment is handled by a payment processor (such as Stripe); they receive only what’s needed to take the payment.</li>
      </ul>
      <p>These providers process data under their own terms and only as needed to provide their service to us.</p>

      <h2>6. Sharing you choose</h2>
      <p>
        If you turn on a public share page, only the information you choose to reveal is made
        visible via a link you control. You can disable it at any time in your settings.
      </p>

      <h2>7. Keeping your data</h2>
      <p>
        We keep your information for as long as your account is active. If you delete your account,
        we delete your bets and personal data, except anything we’re required to keep by law.
      </p>

      <h2>8. Your rights</h2>
      <p>
        You can access and edit your data in the app at any time, and export your bets to CSV. You
        can ask us to delete your account and associated data. Depending on where you live, you may
        also have rights to object to or restrict certain processing, or to complain to your data
        protection regulator (in the UK, the ICO).
      </p>

      <h2>9. Security</h2>
      <p>
        We use reasonable technical measures to protect your data, including hashed passwords and
        encrypted connections (HTTPS). No online service can be guaranteed 100% secure, so please
        use a strong, unique password.
      </p>

      <h2>10. Children</h2>
      <p>Betbooks is not intended for anyone under 18, and we don’t knowingly collect data from under-18s.</p>

      <h2>11. Changes</h2>
      <p>
        We may update this policy from time to time. The “last updated” date at the top shows the
        latest version, and we’ll flag material changes in the app where appropriate.
      </p>

      <h2>12. Contact</h2>
      <p>
        For any privacy question or request, email <a href="mailto:support@betbooks.co.uk">support@betbooks.co.uk</a>.
      </p>
    </LegalLayout>
  );
}
