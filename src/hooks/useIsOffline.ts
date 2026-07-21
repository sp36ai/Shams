import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Tracks device connectivity. Returns true only when the device is
 * definitively offline. Conservative by design: an unknown/null state is
 * treated as online so a flaky probe never shows a false offline banner.
 */
export function useIsOffline(): boolean {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setOffline(state.isConnected === false);
    });
    return () => unsubscribe();
  }, []);

  return offline;
}
