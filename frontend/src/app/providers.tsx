"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, type Config } from "wagmi";
import { createAppKit } from "@reown/appkit/react";
import { sepolia } from "@reown/appkit/networks";
import { wagmiAdapter, projectId } from "@/lib/config";
import { useState, type ReactNode } from "react";

// App metadata
const metadata = {
  name: "ArtEpoch",
  description: "FHE-Powered Art Year Guessing Game",
  url: "https://art-epoch.vercel.app",
  icons: ["https://art-epoch.vercel.app/icon.png"],
};

// Create AppKit modal
createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [sepolia],
  defaultNetwork: sepolia,
  metadata,
  features: {
    analytics: true,
  },
  themeMode: "dark",
  themeVariables: {
    "--w3m-accent": "#C9A962",
    "--w3m-border-radius-master": "2px",
  },
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as Config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
