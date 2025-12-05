"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Lock, RefreshCw, ExternalLink, Shield, Unlock, Github } from "lucide-react";
import artworksData from "@/data/artworks.json";
import type { Artwork, GameState } from "@/lib/types";
import { CONTRACT_ADDRESS, ART_EPOCH_ABI } from "@/lib/config";
import { fheClient } from "@/lib/fheClient";

// Extended game state for real FHE flow
type ExtendedStatus = GameState["status"] | "encrypting" | "sending" | "decrypting" | "error";

interface ExtendedGameState extends Omit<GameState, "status" | "roundId"> {
  status: ExtendedStatus;
  txHash: string | null;
  errorMessage: string | null;
  artworkId: number | null; // Changed from roundId to artworkId
}

interface GameScreenProps {
  onExit: () => void;
}

export function GameScreen({ onExit }: GameScreenProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [gameState, setGameState] = useState<ExtendedGameState>({
    status: "idle",
    currentArtwork: null,
    guess: null,
    result: null,
    artworkId: null,
    txHash: null,
    errorMessage: null,
  });
  const [inputValue, setInputValue] = useState("");
  const [imageLoaded, setImageLoaded] = useState(false);

  // Use only first 30 artworks (on-chain)
  const artworks = (artworksData as Artwork[]).slice(0, 30);

  // Check if artwork exists on chain
  const checkArtworkExists = useCallback(async (artworkId: number) => {
    if (!publicClient) return false;
    try {
      const exists = await publicClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: ART_EPOCH_ABI,
        functionName: "artworkExists",
        args: [BigInt(artworkId)],
      });
      return exists as boolean;
    } catch (error) {
      console.error("[GameScreen] Failed to check artwork:", error);
      return false;
    }
  }, [publicClient]);

  // Select a random artwork that exists on chain
  const selectRandomArtwork = useCallback(async () => {
    setImageLoaded(false);
    setInputValue("");

    // Shuffle and find one that exists on chain
    const shuffled = [...artworks].sort(() => Math.random() - 0.5);
    
    for (const artwork of shuffled) {
      const exists = await checkArtworkExists(artwork.id);
      if (exists) {
        console.log("[GameScreen] Selected artwork #" + artwork.id + " (on-chain)");
        setGameState({
          status: "playing",
          currentArtwork: artwork,
          guess: null,
          result: null,
          artworkId: artwork.id,
          txHash: null,
          errorMessage: null,
        });
        return;
      }
    }

    // No artworks on chain - show error
    console.error("[GameScreen] No artworks found on chain");
    setGameState({
      status: "error",
      currentArtwork: null,
      guess: null,
      result: null,
      artworkId: null,
      txHash: null,
      errorMessage: "No artworks initialized on-chain. Please wait for admin to add artworks.",
    });
  }, [artworks, checkArtworkExists]);

  // Start game on mount
  useEffect(() => {
    if (gameState.status === "idle") {
      selectRandomArtwork();
    }
  }, [gameState.status, selectRandomArtwork]);

  // Handle guess submission
  const handleSubmit = async () => {
    const year = parseInt(inputValue);
    if (isNaN(year) || year < -3000 || year > 2025) {
      return;
    }

    if (!gameState.currentArtwork || !gameState.artworkId) {
      return;
    }

    if (!address || !walletClient || !publicClient) {
      setGameState((prev) => ({
        ...prev,
        status: "error",
        errorMessage: "Wallet not connected",
      }));
      return;
    }

    try {
      // Step 1: Initialize FHE SDK and encrypt
      setGameState((prev) => ({ ...prev, status: "encrypting", guess: year }));
      console.log("[GameScreen] Initializing FHE SDK...");
      
      await fheClient.init();
      console.log("[GameScreen] Encrypting guess...");

      const encrypted = await fheClient.encrypt16(year, CONTRACT_ADDRESS, address);
      const handle = fheClient.getHandleHex(encrypted);
      const inputProof = fheClient.getProofHex(encrypted);

      console.log("[GameScreen] Encrypted handle:", handle);

      // Step 2: Send transaction to contract
      setGameState((prev) => ({ ...prev, status: "sending" }));
      console.log("[GameScreen] Sending transaction...");

      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: ART_EPOCH_ABI,
        functionName: "submitGuess",
        args: [BigInt(gameState.artworkId!), handle, inputProof],
      });

      console.log("[GameScreen] Transaction hash:", hash);
      setGameState((prev) => ({ ...prev, txHash: hash }));

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log("[GameScreen] Transaction confirmed:", receipt.status);

      if (receipt.status === "reverted") {
        throw new Error("Transaction reverted");
      }

      // Step 3: Decrypt the result
      setGameState((prev) => ({ ...prev, status: "decrypting" }));
      console.log("[GameScreen] Decrypting result...");

      // Get the latest encrypted result handle from contract
      const encryptedResult = await publicClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: ART_EPOCH_ABI,
        functionName: "getLatestGuessResult",
        args: [BigInt(gameState.artworkId!), address],
      });

      console.log("[GameScreen] Encrypted result handle:", encryptedResult);

      // Create signer adapter for fheClient
      const signer = {
        getAddress: async (): Promise<string> => address,
        signTypedData: async (
          domain: unknown,
          types: unknown,
          message: unknown
        ): Promise<string> => {
          return walletClient.signTypedData({
            domain: domain as { name: string; version: string; chainId: number; verifyingContract: `0x${string}` },
            types: types as Record<string, { name: string; type: string }[]>,
            primaryType: Object.keys(types as Record<string, unknown>).find((k) => k !== "EIP712Domain") || "Reencrypt",
            message: message as Record<string, unknown>,
          });
        },
      };

      // Decrypt using fheClient
      const decryptedResults = await fheClient.decrypt(
        [{ handle: encryptedResult as string, contractAddress: CONTRACT_ADDRESS }],
        signer
      );

      // Get the decrypted value
      const decryptedDiff = Object.values(decryptedResults)[0];
      console.log("[GameScreen] Decrypted difference:", decryptedDiff);

      // Step 4: Show result
      setGameState((prev) => ({
        ...prev,
        status: "result",
        result: Number(decryptedDiff),
      }));
    } catch (error) {
      console.error("[GameScreen] FHE Error:", error);
      setGameState((prev) => ({
        ...prev,
        status: "error",
        errorMessage: `FHE Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      }));
    }
  };

  const playAgain = () => {
    selectRandomArtwork();
  };

  const { currentArtwork, status, guess, result, txHash, errorMessage, artworkId } = gameState;

  // Error state - no artworks or connection error
  if (status === "error" && !currentArtwork) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0A0A0A] gap-6 p-8">
        <div className="text-red-400 text-6xl">⚠️</div>
        <h2 className="text-2xl text-[#F5F5F0] text-center">FHE Not Available</h2>
        <p className="text-[#A0A0A0] text-center max-w-md">{errorMessage}</p>
        <button
          onClick={onExit}
          className="px-6 py-3 bg-[#C9A962] text-[#0A0A0A] rounded-lg hover:bg-[#D4B872] transition-colors"
        >
          Back to Home
        </button>
      </div>
    );
  }

  // Loading state
  if (!currentArtwork) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0A0A0A] gap-4">
        <div className="spinner" />
        <p className="text-[#A0A0A0] text-sm">Loading artwork...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative bg-[#0A0A0A] overflow-hidden">
      {/* Background Blur */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20 blur-3xl scale-110 transition-all duration-1000"
        style={{ backgroundImage: `url(${currentArtwork.imageUrl})` }}
      />
      <div className="absolute inset-0 bg-black/60 z-0" />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-50 p-6 flex justify-between items-center">
        <button onClick={onExit} className="text-[#F5F5F0]/60 hover:text-[#C9A962] transition-colors">
          <ArrowLeft className="w-8 h-8" />
        </button>
        <div className="flex items-center gap-3">
          {/* FHE indicator */}
          {artworkId && (
            <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 border border-green-500/40 rounded-full">
              <Shield className="w-4 h-4 text-green-400" />
              <span className="text-green-400 text-xs">FHE Enabled</span>
            </div>
          )}
          {/* GitHub Link */}
          <a
            href="https://github.com/hawkhen/ArtEpoch"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-full transition-all"
            title="View on GitHub"
          >
            <Github className="w-4 h-4" />
          </a>
          {/* Wallet address - no logo */}
          {address && (
            <div className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-full text-white/80 text-xs">
              {address.slice(0, 6)}...{address.slice(-4)}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
        <AnimatePresence mode="wait">
          {status === "result" ? (
            <ResultView
              key="result"
              artwork={currentArtwork}
              guess={guess!}
              result={result!}
              txHash={txHash}
              errorMessage={errorMessage}
              onPlayAgain={playAgain}
            />
          ) : status === "error" ? (
            <ErrorView key="error" message={errorMessage || "Unknown error"} onRetry={playAgain} />
          ) : (
            <GameView
              key="game"
              artwork={currentArtwork}
              status={status}
              inputValue={inputValue}
              setInputValue={setInputValue}
              onSubmit={handleSubmit}
              imageLoaded={imageLoaded}
              setImageLoaded={setImageLoaded}
              artworkId={artworkId}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

interface GameViewProps {
  artwork: Artwork;
  status: ExtendedStatus;
  inputValue: string;
  setInputValue: (value: string) => void;
  onSubmit: () => void;
  imageLoaded: boolean;
  setImageLoaded: (loaded: boolean) => void;
  artworkId: number | null;
}

function GameView({
  artwork,
  status,
  inputValue,
  setInputValue,
  onSubmit,
  imageLoaded,
  setImageLoaded,
  artworkId,
}: GameViewProps) {
  const isProcessing =
    status === "encrypting" || status === "sending" || status === "decrypting" || status === "submitting";

  // Validate year input: integer between -3000 BCE and 2025 CE
  const handleYearInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Allow empty input
    if (value === "") {
      setInputValue("");
      return;
    }
    
    // Allow minus sign at start, then only digits
    if (!/^-?\d*$/.test(value)) {
      return;
    }
    
    // Just a minus sign is okay (user is typing)
    if (value === "-") {
      setInputValue("-");
      return;
    }
    
    const num = parseInt(value, 10);
    
    // Limit range: -3000 to 2025
    if (num > 2025) {
      setInputValue("2025");
      return;
    }
    if (num < -3000) {
      setInputValue("-3000");
      return;
    }
    
    setInputValue(value);
  };

  // Check if input is valid for submission
  const isValidYear = () => {
    if (!inputValue || inputValue === "-") return false;
    const num = parseInt(inputValue, 10);
    return !isNaN(num) && num >= -3000 && num <= 2025;
  };

  const getStatusText = () => {
    switch (status) {
      case "encrypting":
        return "Encrypting with FHE...";
      case "sending":
        return "Sending to blockchain...";
      case "decrypting":
        return "Decrypting result...";
      case "submitting":
        return "Processing...";
      default:
        return artworkId ? "Submit Encrypted Guess" : "Submit Guess";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.6 }}
      className="flex flex-col items-center w-full max-w-5xl"
    >
      {/* Artwork */}
      <div className="relative w-full max-w-3xl mb-6">
        <motion.div
          className="artwork-frame relative z-10"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <div className="relative bg-[#0A0A0A] overflow-hidden flex items-center justify-center">
            {!imageLoaded && <div className="spinner absolute" />}
            <img
              src={artwork.imageUrl}
              alt=""
              className={`max-w-full max-h-[45vh] object-contain transition-opacity duration-700 ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
              onLoad={() => setImageLoaded(true)}
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://placehold.co/800x600/1a1a1a/C9A962?text=${encodeURIComponent(
                  artwork.title
                )}`;
                setImageLoaded(true);
              }}
            />
          </div>
        </motion.div>
      </div>

      {/* Input Area */}
      <div className="flex flex-col items-center gap-4 w-full max-w-md relative z-20">
        <h2
          className="text-2xl md:text-3xl text-center text-[#F5F5F0] font-light"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          Which Year?
        </h2>

        <div className="relative w-full group">
          <input
            type="text"
            inputMode="numeric"
            value={inputValue}
            onChange={handleYearInput}
            placeholder="YYYY"
            maxLength={5}
            className="w-full bg-transparent border-b-2 border-[#2A2A2A] text-center text-5xl py-3 text-[#C9A962] focus:border-[#C9A962] focus:outline-none transition-colors placeholder:text-[#2A2A2A] font-serif"
            disabled={isProcessing}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && isValidYear() && onSubmit()}
          />
          <p className="text-center text-lg md:text-xl text-white/70 mt-4">
            Negative for BCE (e.g. <span className="text-[#C9A962] font-semibold">-1345</span>) · Range: -3000 to 2025
          </p>
        </div>

        <button
          onClick={onSubmit}
          disabled={!isValidYear() || isProcessing}
          className={`btn-museum w-full flex items-center justify-center gap-3 ${!isValidYear() || isProcessing ? "opacity-50" : ""}`}
        >
          {isProcessing ? (
            <>
              <div className="spinner w-5 h-5 border-2" />
              <span>{getStatusText()}</span>
            </>
          ) : (
            <>
              {artworkId ? <Lock className="w-5 h-5" /> : null}
              <span>{getStatusText()}</span>
            </>
          )}
        </button>

        {/* FHE indicator */}
        {artworkId && (
          <div className="flex items-center gap-2 text-[#A0A0A0] text-xs">
            <Shield className="w-4 h-4" />
            <span>Your guess will be encrypted with FHE before submission</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

interface ResultViewProps {
  artwork: Artwork;
  guess: number;
  result: number;
  txHash: string | null;
  errorMessage: string | null;
  onPlayAgain: () => void;
}

function ResultView({ artwork, guess, result, txHash, errorMessage, onPlayAgain }: ResultViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center w-full max-w-4xl"
    >
      {/* Error message if any */}
      {errorMessage && (
        <div className="mb-6 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-yellow-400 text-sm text-center">{errorMessage}</p>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-center gap-12 w-full">
        {/* Artwork (Smaller) */}
        <motion.div
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="w-full md:w-1/2"
        >
          <div className="artwork-frame">
            <img src={artwork.imageUrl} alt="" className="w-full h-auto object-contain" referrerPolicy="no-referrer" />
          </div>
          <div className="mt-6 text-center md:text-left">
            <h3 className="text-2xl text-[#F5F5F0] font-serif italic">{artwork.title}</h3>
            <p className="text-[#C9A962] mt-1">{artwork.artist}</p>
          </div>
        </motion.div>

        {/* Result Info */}
        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="w-full md:w-1/2 flex flex-col items-center md:items-start"
        >
          {/* Decrypted badge */}
          {txHash && (
            <div className="flex items-center gap-2 mb-4 px-3 py-1 bg-green-500/20 border border-green-500/40 rounded-full">
              <Unlock className="w-4 h-4 text-green-400" />
              <span className="text-green-400 text-xs">Decrypted from chain</span>
            </div>
          )}

          <div className="mb-8">
            <p className="text-[#A0A0A0] text-sm uppercase tracking-widest mb-2">Difference</p>
            <div className="flex items-baseline gap-2">
              <span className="text-8xl md:text-9xl text-[#C9A962] font-serif leading-none">{result}</span>
              <span className="text-xl text-[#A0A0A0]">years</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 w-full border-t border-[#2A2A2A] pt-8 mb-8">
            <div>
              <p className="text-[#A0A0A0] text-xs uppercase tracking-widest mb-1">Your Guess</p>
              <p className="text-3xl text-[#F5F5F0] font-serif">{guess}</p>
            </div>
            <div>
              <p className="text-[#A0A0A0] text-xs uppercase tracking-widest mb-1">Actual Year</p>
              <p className="text-3xl text-[#F5F5F0] font-serif">{artwork.year}</p>
            </div>
          </div>

          <div className="flex gap-4 w-full">
            <button onClick={onPlayAgain} className="btn-museum flex-1 flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5" />
              <span>Next Art</span>
            </button>
            {txHash ? (
              <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 border border-[#2A2A2A] text-[#A0A0A0] hover:text-[#C9A962] hover:border-[#C9A962] transition-all"
                title="View on Etherscan"
              >
                <ExternalLink className="w-6 h-6" />
              </a>
            ) : (
              <a
                href="https://sepolia.etherscan.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 border border-[#2A2A2A] text-[#A0A0A0] hover:text-[#C9A962] hover:border-[#C9A962] transition-all"
              >
                <ExternalLink className="w-6 h-6" />
              </a>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

interface ErrorViewProps {
  message: string;
  onRetry: () => void;
}

function ErrorView({ message, onRetry }: ErrorViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6 text-center max-w-md"
    >
      <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
        <span className="text-3xl">⚠️</span>
      </div>
      <h2 className="text-2xl text-[#F5F5F0] font-serif">Something went wrong</h2>
      <p className="text-[#A0A0A0]">{message}</p>
      <button onClick={onRetry} className="btn-museum">
        Try Again
      </button>
    </motion.div>
  );
}
