"use client";

import { useState, useEffect, useMemo } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion, AnimatePresence } from "framer-motion";
import { GameScreen } from "@/components/GameScreen";
import { FhevmStatus } from "@/components/FhevmStatus";
import { Palette, Copy, LogOut, Check } from "lucide-react";
import artworksData from "@/data/artworks.json";

export default function Home() {
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setShowWalletMenu(false);
  };

  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

  // Prepare artwork strips for background (now using local images)
  const artworkStrips = useMemo(() => {
    // Use a stable shuffled order (seeded by array length) to enable browser caching
    const shuffled = [...artworksData].sort((a, b) => (a.id * 7) % 50 - (b.id * 7) % 50);

    // Split into 3 strips
    const chunkSize = Math.ceil(shuffled.length / 3);
    return [
      shuffled.slice(0, chunkSize),
      shuffled.slice(chunkSize, chunkSize * 2),
      shuffled.slice(chunkSize * 2),
    ];
  }, []);

  // Handler to hide broken images completely
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    const parent = target.parentElement;
    if (parent) {
      parent.style.display = "none";
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="spinner" />
      </div>
    );
  }

  if (showGame && isConnected) {
    return <GameScreen onExit={() => setShowGame(false)} />;
  }

  return (
    <main className="min-h-screen relative overflow-hidden bg-[#050505]">
      {/* Header Bar - Fixed Position */}
      <div className="fixed top-4 left-4 right-4 z-50 flex justify-between items-center">
        <FhevmStatus />
        {isConnected && (
          <div className="relative">
            <button
              onClick={() => setShowWalletMenu(!showWalletMenu)}
              className="px-4 py-2 text-sm text-white/80 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-full transition-all"
            >
              {shortAddress}
            </button>
            
            {/* Custom Dropdown Menu */}
            <AnimatePresence>
              {showWalletMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 mt-2 w-48 bg-black/90 backdrop-blur-md border border-white/20 rounded-lg overflow-hidden shadow-xl"
                >
                  <button
                    onClick={copyAddress}
                    className="w-full px-4 py-3 flex items-center gap-3 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-all"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? "Copied!" : "Copy Address"}</span>
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="w-full px-4 py-3 flex items-center gap-3 text-sm text-red-400 hover:text-red-300 hover:bg-white/10 transition-all border-t border-white/10"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Disconnect</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Dynamic Background: Vibrant River of Art */}
      <div className="absolute inset-0 z-0 flex flex-col justify-center gap-6 select-none" style={{ transform: 'rotate(-2deg) scale(1.1)' }}>
        {/* Strip 1 */}
        <div className="relative w-full overflow-hidden h-[240px]">
          <div className="absolute flex animate-marquee whitespace-nowrap">
            {/* Repeat 2 times for perfect 50% translation loop */}
            {[...artworkStrips[0], ...artworkStrips[0]].map((art, i) => (
              <div key={`s1-${i}`} className="w-[320px] h-[240px] mr-6 flex-shrink-0 relative transition-transform duration-500 hover:scale-105 hover:z-10 cursor-pointer bg-[#111] rounded-sm overflow-hidden">
                <img 
                  src={art.imageUrl} 
                  alt="" 
                  className="w-full h-full object-cover shadow-2xl" 
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={handleImageError}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Strip 2 (Reverse) */}
        <div className="relative w-full overflow-hidden h-[240px]">
          <div className="absolute flex animate-marquee-reverse whitespace-nowrap" style={{ left: '-50%' }}>
            {[...artworkStrips[1], ...artworkStrips[1]].map((art, i) => (
              <div key={`s2-${i}`} className="w-[320px] h-[240px] mr-6 flex-shrink-0 relative transition-transform duration-500 hover:scale-105 hover:z-10 cursor-pointer bg-[#111] rounded-sm overflow-hidden">
                <img 
                  src={art.imageUrl} 
                  alt="" 
                  className="w-full h-full object-cover shadow-2xl" 
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={handleImageError}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Strip 3 */}
        <div className="relative w-full overflow-hidden h-[240px]">
          <div className="absolute flex animate-marquee whitespace-nowrap">
            {[...artworkStrips[2], ...artworkStrips[2]].map((art, i) => (
              <div key={`s3-${i}`} className="w-[320px] h-[240px] mr-6 flex-shrink-0 relative transition-transform duration-500 hover:scale-105 hover:z-10 cursor-pointer bg-[#111] rounded-sm overflow-hidden">
                <img 
                  src={art.imageUrl} 
                  alt="" 
                  className="w-full h-full object-cover shadow-2xl" 
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={handleImageError}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vignette Overlay (Only darker at edges, transparent center) */}
      <div className="absolute inset-0 z-1 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.2)_0%,rgba(0,0,0,0.8)_80%,#000_100%)] pointer-events-none" />
      
      {/* Tint Overlay for vibrancy */}
      <div className="absolute inset-0 z-1 mix-blend-overlay bg-gradient-to-tr from-purple-900/30 via-transparent to-blue-900/30 pointer-events-none" />

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
        
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="text-center mb-16 animate-float relative"
        >
          {/* Backdrop Blur for text readability */}
          <div className="absolute inset-0 -z-10 bg-black/40 blur-3xl rounded-full scale-150" />

          <div className="flex items-center justify-center gap-3 mb-6">
            <Palette className="w-6 h-6 text-white" />
            <span className="text-white/90 tracking-[0.3em] text-xs uppercase font-bold bg-white/10 px-3 py-1 rounded-full backdrop-blur-md">
              Zama FHEVM Powered
            </span>
          </div>
          
          <h1
            className="text-8xl md:text-[10rem] font-bold tracking-tighter text-vibrant-gradient mb-4 leading-none drop-shadow-2xl"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            ArtEpoch
          </h1>
          
          <p
            className="text-2xl md:text-3xl text-white font-light italic tracking-wide drop-shadow-lg"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            Revive the Era
          </p>
        </motion.div>

        {/* Action Area */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="relative"
        >
           {/* Glow Effect behind button */}
           <div className="absolute inset-0 bg-white/20 blur-2xl scale-150 animate-pulse rounded-full" />

          {!isConnected ? (
            <div className="flex flex-col items-center gap-6 glass-panel p-10 rounded-xl relative z-10 border border-white/20">
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <button onClick={openConnectModal} className="btn-museum text-xl min-w-[240px]">
                    Connect Wallet
                  </button>
                )}
              </ConnectButton.Custom>
            </div>
          ) : (
            <div className="flex flex-col items-center relative z-10">
              <button
                onClick={() => setShowGame(true)}
                className="btn-museum text-3xl px-16 py-8 hover:scale-105 transition-transform"
              >
                Start Guessing
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </main>
  );
}
