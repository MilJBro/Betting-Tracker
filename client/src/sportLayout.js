// Which bet-slip layout a sport uses. The slip adapts to the sport:
//  · 'versus'  head-to-head (football, tennis, boxing...): "Home v Away".
//  · 'racing'  horse / greyhound racing: a course + time and the runner.
//  · 'field'   other field sports (golf, motorsport, cycling...): one event.
// Racing and field both offer each-way. The sport is free text (the dropdown
// has a starter list plus "Other..."), so this matches on keywords, not names.
// Anything unrecognised is treated as head-to-head.

// Motorsport first: "Motor racing" must be a field sport, not horse-style racing.
const MOTOR = [/moto/, /formula/, /\bf1\b/, /indy/, /nascar/, /rally/, /\bwrc\b/, /speedway/, /kart/, /drag rac/, /supercar/, /\bdtm\b/, /le mans/, /endurance/];
const RACING = [/horse/, /greyhound/, /harness/, /trot/, /pigeon/, /camel/, /\bdogs?\b/, /racing/];
const FIELD = [
  /golf/, /cycl/, /tour de/, /giro/, /vuelta/, /athletic/, /olympic/, /swim/, /marathon/,
  /triathlon/, /decathlon/, /pentathlon/, /gymnast/, /weightlift/, /\bski(ing)?\b/,
  /snowboard/, /\bsurf/, /\bsail/, /\brow(ing)?\b/, /regatta/, /poker/, /darts/, /snooker/,
];

export function sportLayout(sport) {
  const s = String(sport || '').trim().toLowerCase();
  if (!s) return 'versus';
  if (MOTOR.some((re) => re.test(s))) return 'field';
  if (RACING.some((re) => re.test(s))) return 'racing';
  if (FIELD.some((re) => re.test(s))) return 'field';
  return 'versus';
}
