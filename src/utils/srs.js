const MIN_EASE = 1.3;
const MAX_EASE = 3.0;

// SM-2 inspired scheduling
// rating: 1=Again, 2=Hard, 3=Good, 4=Easy
export function scheduleCard(card, rating) {
  let { interval = 0, easeFactor = 2.5, reviews = 0 } = card;

  if (rating === 1) {
    interval = 1;
    easeFactor = Math.max(MIN_EASE, easeFactor - 0.2);
  } else if (rating === 2) {
    interval = reviews === 0 ? 1 : Math.max(1, Math.round(interval * 1.2));
    easeFactor = Math.max(MIN_EASE, easeFactor - 0.15);
  } else if (rating === 3) {
    if (reviews === 0) interval = 1;
    else if (reviews === 1) interval = 4;
    else interval = Math.round(interval * easeFactor);
  } else {
    if (reviews === 0) interval = 4;
    else interval = Math.round(interval * easeFactor * 1.3);
    easeFactor = Math.min(MAX_EASE, easeFactor + 0.15);
  }

  interval = Math.max(1, interval);
  const nextReview = Date.now() + interval * 24 * 60 * 60 * 1000;
  return { interval, easeFactor, nextReview, reviews: reviews + 1 };
}

export function isDue(card) {
  if (!card.nextReview) return true;
  return Date.now() >= card.nextReview;
}
