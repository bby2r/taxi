import { createNavigationContainerRef } from '@react-navigation/native';

// Each app declares its own RootStackParamList — the shared navigationRef
// is structurally typed by react-navigation, so callers can cast as needed.
export const navigationRef = createNavigationContainerRef();
