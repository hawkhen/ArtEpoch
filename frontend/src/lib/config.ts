import { http } from "wagmi";
import { sepolia } from "@reown/appkit/networks";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";

// Contract address on Sepolia (v3 - unlimited guesses)
export const CONTRACT_ADDRESS = "0x555D3Ed18c687EAf09B3087Cc847EEE33cf87208";

// Sepolia RPC - Alchemy endpoint
export const SEPOLIA_RPC = "https://eth-sepolia.g.alchemy.com/v2/xeMfJRSGpIGq5WiFz-bEiHoG6DGrZnAr";

// Reown Project ID from dashboard.reown.com
export const projectId = "42a5c65f3530bd77a4076f1296beb2bb";

// Networks
export const networks = [sepolia];

// Wagmi Adapter for Reown AppKit
export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  transports: {
    [sepolia.id]: http(SEPOLIA_RPC),
  },
});

// Export wagmi config from adapter
export const config = wagmiAdapter.wagmiConfig;

// Contract ABI - v3 with unlimited guesses
export const ART_EPOCH_ABI = [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  // Admin: Add artwork with encrypted year
  {
    inputs: [
      { name: "artworkId", type: "uint256" },
      { name: "encryptedYear", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    name: "addArtwork",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Player: Submit guess (returns nonce)
  {
    inputs: [
      { name: "artworkId", type: "uint256" },
      { name: "encryptedGuess", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    name: "submitGuess",
    outputs: [{ name: "nonce", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  // View: Check if artwork exists
  {
    inputs: [{ name: "artworkId", type: "uint256" }],
    name: "artworkExists",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  // View: Get guess count
  {
    inputs: [
      { name: "artworkId", type: "uint256" },
      { name: "player", type: "address" },
    ],
    name: "getGuessCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // View: Get guess result by nonce
  {
    inputs: [
      { name: "artworkId", type: "uint256" },
      { name: "player", type: "address" },
      { name: "nonce", type: "uint256" },
    ],
    name: "getGuessResult",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  // View: Get latest guess result
  {
    inputs: [
      { name: "artworkId", type: "uint256" },
      { name: "player", type: "address" },
    ],
    name: "getLatestGuessResult",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  // View: Total artworks
  {
    inputs: [],
    name: "totalArtworks",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // View: Total guesses
  {
    inputs: [],
    name: "totalGuesses",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "artworkId", type: "uint256" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
    name: "ArtworkAdded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "artworkId", type: "uint256" },
      { indexed: true, name: "player", type: "address" },
      { indexed: false, name: "nonce", type: "uint256" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
    name: "GuessSubmitted",
    type: "event",
  },
] as const;
