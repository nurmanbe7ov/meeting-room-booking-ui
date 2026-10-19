import { useEffect, useState } from 'react';

const msUntilNextMinute = (): number => {
  const now = new Date();
  return 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds());
};

export const useNow = (): Date => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timeoutId = window.setTimeout(function tick() {
      setNow(new Date());
      timeoutId = window.setTimeout(tick, msUntilNextMinute());
    }, msUntilNextMinute());

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') setNow(new Date());
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return now;
};
