import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

// Refresh when returning from the background and across local midnight.
export function useProgressRefresh(): number {
  const [revision, setRevision] = useState(0);
  useFocusEffect(useCallback(() => {
    setRevision(value => value + 1);
    const timer = setInterval(() => setRevision(value => value + 1), 60_000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') setRevision(value => value + 1);
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []));
  return revision;
}
