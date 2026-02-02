"use client";

import { useRef, useState, useCallback, useEffect, memo } from "react";

type SplitFlapDisplayProps = {
  value: string;
  className?: string;
  style?: React.CSSProperties;
};

const SplitFlapChar = memo(function SplitFlapChar({
  char,
  flipKey,
  isPanel,
}: {
  char: string;
  flipKey: number;
  isPanel: boolean;
}) {
  const [animating, setAnimating] = useState(false);
  const prevFlipKey = useRef(flipKey);

  useEffect(() => {
    if (flipKey !== prevFlipKey.current) {
      prevFlipKey.current = flipKey;
      setAnimating(true);
    }
  }, [flipKey]);

  const handleAnimationEnd = useCallback(() => {
    setAnimating(false);
  }, []);

  return (
    <span
      className={`split-flap-char ${isPanel ? "split-flap-panel" : "split-flap-separator"}`}
    >
      <span
        className={`split-flap-char-inner${animating ? " flipping" : ""}`}
        onAnimationEnd={handleAnimationEnd}
      >
        {char}
      </span>
    </span>
  );
});

function computeFlipKeys(
  chars: string[],
  prevChars: string[],
  prevFlipKeys: number[],
): number[] {
  const newFlipKeys: number[] = new Array(chars.length).fill(0);
  const lengthDiff = chars.length - prevChars.length;

  for (let i = 0; i < chars.length; i++) {
    const prevIndex = i - lengthDiff;
    const prevFlipKey =
      prevIndex >= 0 && prevIndex < prevFlipKeys.length
        ? prevFlipKeys[prevIndex]
        : 0;
    const prevChar =
      prevIndex >= 0 && prevIndex < prevChars.length
        ? prevChars[prevIndex]
        : "";

    newFlipKeys[i] = chars[i] !== prevChar ? prevFlipKey + 1 : prevFlipKey;
  }

  return newFlipKeys;
}

export default function SplitFlapDisplay({
  value,
  className,
  style,
}: SplitFlapDisplayProps) {
  const prevValue = useRef(value);
  const flipKeys = useRef<number[]>([]);

  const chars = value.split("");
  const newFlipKeys = computeFlipKeys(
    chars,
    prevValue.current.split(""),
    flipKeys.current,
  );

  // Commit ref mutations after render, safe with concurrent mode
  useEffect(() => {
    flipKeys.current = newFlipKeys;
    prevValue.current = value;
  });

  return (
    <span className={`split-flap ${className ?? ""}`} style={style}>
      {chars.map((char, i) => (
        <SplitFlapChar
          key={i}
          char={char}
          flipKey={newFlipKeys[i]}
          isPanel={/\d/.test(char)}
        />
      ))}
    </span>
  );
}
