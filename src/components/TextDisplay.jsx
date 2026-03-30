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

export default function TextDisplay({ tokenLines, onWordClick }) {
  return (
    <div className="text-display">
      {tokenLines.map((line, i) => (
        <p key={i} className="text-line">
          {line.map((token, j) => (
            <WordToken key={j} token={token} onClick={onWordClick} />
          ))}
        </p>
      ))}
    </div>
  );
}
