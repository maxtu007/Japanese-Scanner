import { toHiragana } from '../utils/japanese';

const KANJI = /[\u4E00-\u9FFF\u3400-\u4DBF]/;
const PUNCT_RE = /^[\s。、！？…「」『』【】（）〔〕・～—\-\/]+$/;

function WordToken({ token, onClick }) {
  const surface = token.surface_form;

  if (PUNCT_RE.test(surface) || token.pos === '記号') {
    return <span className="punct">{surface}</span>;
  }

  const reading = toHiragana(token.reading);
  const showFurigana = KANJI.test(surface) && reading && reading !== surface;

  if (showFurigana) {
    return (
      <ruby className="token" onClick={() => onClick(token)}>
        {surface}
        <rt>{reading}</rt>
      </ruby>
    );
  }

  return (
    <span className="token" onClick={() => onClick(token)}>
      {surface}
    </span>
  );
}

export default function TextDisplay({ tokenBlocks, onWordClick, showTranslations }) {
  return (
    <div className="text-display">
      {tokenBlocks.map((block, bi) => (
        <div key={bi} className="text-block">
          {block.sentences.map((sent, li) => (
            <div key={li} className="sentence-unit">
              <p className="text-line">
                {sent.tokens.map((token, ti) => (
                  <WordToken key={ti} token={token} onClick={onWordClick} />
                ))}
              </p>
              {showTranslations && sent.translation && (
                <p className="sentence-translation">{sent.translation}</p>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
