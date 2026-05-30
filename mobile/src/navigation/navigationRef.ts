import { createNavigationContainerRef } from '@react-navigation/native';

import type { AppStackParamList } from './types';

// Standalone module (no app imports) so non-React code can navigate without
// creating a require cycle with the navigation container / screens.
export const navigationRef = createNavigationContainerRef<AppStackParamList>();
