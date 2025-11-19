import React, { createContext, useContext, useEffect, useState } from 'react';

export type FeatureFlags = {
  enableGpt5: boolean;
  model: string;
};

const defaultFlags: FeatureFlags = {
  enableGpt5: (process.env.REACT_APP_ENABLE_GPT5 ?? '').toLowerCase() === 'true',
  model: process.env.REACT_APP_GPT_MODEL || 'gpt-5',
};

const FeatureFlagsContext = createContext<{ flags: FeatureFlags; loading: boolean }>({ flags: defaultFlags, loading: false });

export const FeatureFlagsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [flags, setFlags] = useState<FeatureFlags>(defaultFlags);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/config');
        if (!res.ok) throw new Error('config');
        const data = await res.json();
        const remote: FeatureFlags = {
          enableGpt5: !!data?.features?.enableGpt5,
          model: data?.model || flags.model,
        };
        if (mounted) setFlags((prev) => ({ ...prev, ...remote }));
      } catch {
        // ignore; use defaults
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  return (
    <FeatureFlagsContext.Provider value={{ flags, loading }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};

export const useFeatureFlags = () => useContext(FeatureFlagsContext);
