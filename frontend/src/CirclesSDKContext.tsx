import React, { createContext, useEffect, useState } from 'react';
import { Sdk } from '@aboutcircles/sdk';
import { circlesConfig } from '@aboutcircles/sdk-core';
import { onWalletChange, isMiniappMode } from '@aboutcircles/miniapp-sdk';

export const CirclesSDKContext = createContext<any>(null);

export const CirclesSDKProvider = ({ children }: { children: React.ReactNode }) => {
  const [sdk, setSdk] = useState<Sdk | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (isMiniappMode()) {
      console.log("[Circles] Running in MiniApp Mode");
      
      const cleanup = onWalletChange((newAddress) => {
        console.log("[Circles] Received wallet address from host:", newAddress);
        if (newAddress) {
          // Initialize read-only SDK. Writes are handled via sendTransactions() from miniapp-sdk
          setSdk(new Sdk(circlesConfig[100]));
          setAddress(newAddress);
          setIsConnected(true);
        } else {
          setSdk(null);
          setAddress(null);
          setIsConnected(false);
        }
      });
      
      return () => {
        if (typeof cleanup === 'function') cleanup();
      };
    } else {
      console.warn("[Circles] Standalone mode. Using mock address for UI testing.");
      setSdk(new Sdk(circlesConfig[100]));
      setAddress('0x00000000000000000000000000000000Mock');
      setIsConnected(true);
    }
  }, []);

  return (
    <CirclesSDKContext.Provider value={{ sdk, address, isConnected }}>
      {children}
    </CirclesSDKContext.Provider>
  );
};

