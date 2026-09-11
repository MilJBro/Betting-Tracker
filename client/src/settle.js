// Work out the payout to store when quickly settling a bet to a given status,
// without opening the form. Handles each-way correctly: the stored stake is the
// doubled total, and a win pays the Win part plus the Place part.
const round2 = (n) => Math.round(n * 100) / 100;

function ewFraction(frac) {
  const [a, b] = String(frac || '1/5').split('/').map(Number);
  return b > 0 ? a / b : 0.2;
}

export function settlePayout(bet, status) {
  const stake = Number(bet.stake) || 0;
  const odds = Number(bet.odds) || 0;
  if (status === 'lost') return 0;
  if (status === 'void') return stake; // stake returned in full
  if (bet.each_way) {
    const perPart = stake / 2;
    const placeMult = 1 + (odds - 1) * ewFraction(bet.ew_fraction);
    const winReturn = perPart * odds;
    const placeReturn = perPart * placeMult;
    if (status === 'placed') return round2(placeReturn);
    if (status === 'won') return round2(winReturn + placeReturn);
  }
  if (status === 'won') return round2(stake * odds);
  if (status === 'placed') return round2(stake); // non-each-way place ≈ stake back
  return '';
}

// The outcomes offered when quick-settling — Placed only makes sense each-way.
export function settleOptions(bet) {
  const base = [
    { status: 'won', label: 'Won', cls: 'settle-win' },
    { status: 'lost', label: 'Lost', cls: 'settle-loss' },
  ];
  const more = [];
  if (bet.each_way) more.push({ status: 'placed', label: 'Placed', cls: '' });
  more.push({ status: 'void', label: 'Void', cls: '' });
  return { base, more };
}
