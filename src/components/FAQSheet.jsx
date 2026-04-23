const FAQS = [
  {
    q: 'What is Unblur?',
    a: 'Unblur lets you scan any Japanese text — manga, books, signs, menus — and instantly breaks it down word by word with readings, translations, and grammar explanations.',
  },
  {
    q: 'How do I scan something?',
    a: 'Tap the Scan tab, then the camera button. Select a photo from your library or take a new one. Unblur will process it automatically.',
  },
  {
    q: 'What kind of text can Unblur read?',
    a: 'Printed Japanese works best — manga, novels, signs, menus, and screenshots. Both horizontal and vertical text are supported. Handwriting and very small or blurry text may be less accurate.',
  },
  {
    q: 'Does Unblur work offline?',
    a: 'An internet connection is required for scanning and translation. Furigana readings and the built-in dictionary work locally on your device.',
  },
  {
    q: 'How accurate are the translations?',
    a: 'Very accurate for standard written Japanese. Like all AI tools, it can occasionally make mistakes — treat results as a learning aid, not a definitive reference.',
  },
  {
    q: 'What are furigana and romaji?',
    a: 'Furigana shows small hiragana readings above kanji so you know how to pronounce them. Romaji converts the text to Latin letters. Toggle either from the pill buttons at the bottom of a scan result.',
  },
  {
    q: 'How do I save vocabulary?',
    a: 'Tap any word in a scan result to see its definition and explanation. Tap "Add to Deck" to save it to a flashcard deck for later study.',
  },
  {
    q: 'How do I cancel my subscription?',
    a: 'Open the iPhone Settings app → tap your name → Subscriptions → Unblur → Cancel Subscription. You keep access until the end of your current billing period.',
  },
  {
    q: 'How do I restore a previous purchase?',
    a: 'Go to Account → Restore Purchase. This re-syncs your subscription if you reinstalled the app or switched to a new device.',
  },
  {
    q: 'Why does Unblur need photo and camera access?',
    a: 'To let you select or take photos to scan. Unblur only accesses images you explicitly choose — it never reads your camera roll automatically.',
  },
];

export default function FAQSheet({ onClose }) {
  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div
        className="confirm-sheet"
        style={{ maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        <p className="confirm-title">FAQ</p>

        <div style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          padding: '4px 0 8px',
        }}>
          {FAQS.map(({ q, a }, i) => (
            <div key={i}>
              <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', margin: '0 0 4px' }}>{q}</p>
              <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.55', margin: 0 }}>{a}</p>
            </div>
          ))}
        </div>

        <button className="confirm-btn confirm-btn-cancel" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
