// Real customer reviews shown on the landing page.
//
// Only add reviews that real users have actually given you, with their OK to
// publish them. Invented or edited-for-effect quotes are fake reviews, which is
// unlawful in the UK and misleads people deciding whether to pay.
//
// If the reviewer has a connection to the business (friend, family, early
// tester, paid or rewarded), say so in `detail`.
//
// While this list is empty the "What people say" section is hidden entirely.
//
// Each review:
//   quote   the user's own words (lightly trimmed for length is fine; don't
//           change the meaning)
//   name    first name or username, as they're happy to be shown
//   detail  optional, e.g. "Early tester" or "Football punter"
//   rating  optional, 1 to 5. Leave out if they didn't give one.
export const REVIEWS = [
  {
    quote: 'Thanks to Betbooks, I’ve been able to increase my units within a matter of weeks, as I know where I’m winning and losing.',
    name: 'Andrew',
    detail: 'Early tester',
  },
  {
    quote: 'Being up to date with my data shows me where my bad habits are in the long run. Betbooks has helped me cut these out for more consistent wins.',
    name: 'Darren',
    detail: 'Early tester',
  },
];
