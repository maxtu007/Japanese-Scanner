import { toHiragana, toRomaji } from '../utils/japanese';

const KANJI = /[\u4E00-\u9FFF\u3400-\u4DBF]/;
const PUNCT_RE = /^[\s。、！？…「」『』【】（）〔〕・～—\-\/]+$/;

function WordToken({ token, sentence, showFurigana, showRomaji, onClick }) {
  const surface = token.surface_form;

  if (PUNCT_RE.test(surface) || token.pos === '記号') {
    return <span className="punct">{surface}</span>;
  }

  const reading = toHiragana(token.reading);

  // Furigana mode: native <ruby> — exactly as before romaji was added
  if (showFurigana && reading && KANJI.test(surface) && reading !== surface) {
    return (
      <ruby className="token" onClick={() => onClick(token, sentence)}>
        {surface}
        <rt>{reading}</rt>
      </ruby>
    );
  }

  // Romaji mode: same <ruby>/<rt> approach as furigana — keeps native line spacing
  if (showRomaji && reading) {
    return (
      <ruby className="token" onClick={() => onClick(token, sentence)}>
        {surface}
        <rt className="rt-romaji">{toRomaji(reading)}</rt>
      </ruby>
    );
  }

  return (
    <span className="token" onClick={() => onClick(token, sentence)}>
      {surface}
    </span>
  );
}

export default function TextDisplay({ tokenBlocks, onWordClick, showTranslations, showFurigana, showRomaji }) {
  return (
    <div className="text-display">
      {tokenBlocks.map((block, bi) => (
        <div key={bi} className="text-block">
          {block.sentences.map((sent, li) => {
            return (
              <div key={li} className="sentence-unit">
                <p className="text-line">
                  {sent.tokens.map((token, ti) => (
                    <WordToken
                      key={ti}
                      token={token}
                      sentence={sent}
                      showFurigana={showFurigana}
                      showRomaji={showRomaji}
                      onClick={onWordClick}
                    />
                  ))}
                </p>
                {showTranslations && sent.translation && (
                  <p className="sentence-translation">{sent.translation}</p>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
