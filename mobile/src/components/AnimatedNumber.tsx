import { useEffect, useRef, useState } from 'react';
import { Text, type TextStyle, type StyleProp } from 'react-native';

interface Props {
  value: number;
  style?: StyleProp<TextStyle>;
  duration?: number;
}

/**
 * Smoothly counts to `value` using a JS interval. Kept dependency-free (no
 * reanimated/worklets) for reliable startup across Expo Go.
 */
export default function AnimatedNumber({ value, style, duration = 800 }: Props) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) {
      setDisplay(value);
      return undefined;
    }
    const start = Date.now();
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / duration);
      setDisplay(Math.round(from + (value - from) * t));
      if (t >= 1) {
        fromRef.current = value;
        clearInterval(id);
      }
    }, 30);
    return () => clearInterval(id);
  }, [value, duration]);

  return <Text style={style}>{display}</Text>;
}
