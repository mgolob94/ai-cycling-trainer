import { useEffect } from 'react';
import { TextInput, type TextStyle, type StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
} from 'react-native-reanimated';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface Props {
  value: number;
  style?: StyleProp<TextStyle>;
  duration?: number;
}

/**
 * Smoothly counts up/down to `value` on the UI thread (reanimated). Rendered via
 * a read-only TextInput whose `text` prop is driven by animatedProps.
 */
export default function AnimatedNumber({ value, style, duration = 800 }: Props) {
  const sv = useSharedValue(value);

  useEffect(() => {
    sv.value = withTiming(value, { duration });
  }, [value, duration, sv]);

  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const text = `${Math.round(sv.value)}`;
    return { text, defaultValue: text } as never;
  });

  return (
    <AnimatedTextInput
      editable={false}
      underlineColorAndroid="transparent"
      style={style}
      animatedProps={animatedProps}
    />
  );
}
