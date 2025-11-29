# ArtEpoch 🎨🔐

**On-Chain Art Guessing Game — Powered by Zama FHE**

Guess the creation year of famous artworks. Your answer is encrypted on-chain using Fully Homomorphic Encryption (FHE), ensuring fair play where no one can cheat — not even the contract owner.

---

## 🌟 Features

- **FHE-Encrypted Answers** — All answers are encrypted on-chain using Zama FHEVM; the correct year is never exposed
- **Fair & Trustless** — Results computed entirely on-chain without revealing secrets
- **Unlimited Guesses** — Play as many times as you want with random artwork selection
- **Museum-Quality UI** — Elegant dark theme with golden accents, smooth animations, designed for art lovers

---

## 🎮 How It Works

```
1. Connect your wallet (Sepolia testnet)
2. View a randomly selected artwork
3. Guess the creation year (e.g., 1889 or -500 for BCE)
4. Your guess is FHE-encrypted and submitted to the blockchain
5. The contract computes |your_guess - correct_year| using FHE operations
6. Decrypt and see how close you were — then try another artwork!
```

---

## 🔐 Why FHE Matters

Traditional smart contracts expose all data on-chain. With Zama FHEVM:

| Problem | FHE Solution |
|---------|--------------|
| Anyone can read contract state | Correct answers remain encrypted forever |
| Players can cheat by reading answers | Computation happens on encrypted data |
| Need trusted oracles for fairness | Trustless on-chain verification |
| Single-player only | Enables multiplayer without revealing guesses |

**Real-World Impact:** This pattern can be applied to quizzes, exams, auctions, voting, and any scenario requiring hidden information with verifiable computation.

---

## 🛠️ Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Smart Contract | Solidity + Zama FHEVM | @fhevm/solidity ^0.9.1 |
| Frontend SDK | @zama-fhe/relayer-sdk | 0.3.0-6 |
| Frontend | Next.js + TypeScript + Tailwind CSS | Next.js 16 |
| Wallet | RainbowKit + wagmi | Latest |
| Network | Ethereum Sepolia Testnet | — |

---

## 📜 Smart Contract

**Contract Address:** [`0x555D3Ed18c687EAf09B3087Cc847EEE33cf87208`](https://sepolia.etherscan.io/address/0x555D3Ed18c687EAf09B3087Cc847EEE33cf87208)

### FHE Operations Used

```solidity
// All computation happens on encrypted values (euint16)
euint16 guess = FHE.fromExternal(encryptedGuess, inputProof);  // Verify encrypted input
euint16 answer = artworks[artworkId].encryptedYear;            // Stored encrypted

// Calculate |guess - answer| without revealing either value
euint16 diff1 = FHE.sub(guess, answer);
euint16 diff2 = FHE.sub(answer, guess);
ebool guessGreater = FHE.gt(guess, answer);
euint16 absDiff = FHE.select(guessGreater, diff1, diff2);      // Encrypted result

// ACL: Only the player can decrypt their own result
FHE.allow(absDiff, msg.sender);
```

### Core Functions

```solidity
// Admin: Add artwork with encrypted year
function addArtwork(uint256 artworkId, externalEuint16 encryptedYear, bytes calldata inputProof) external onlyOwner;

// Player: Submit encrypted guess (unlimited attempts)
function submitGuess(uint256 artworkId, externalEuint16 encryptedGuess, bytes calldata inputProof) external returns (uint256 nonce);

// View: Get encrypted result for decryption
function getLatestGuessResult(uint256 artworkId, address player) external view returns (euint16);
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm
- MetaMask wallet
- Sepolia testnet ETH ([Faucet](https://sepoliafaucet.com/))

### Run Locally

```bash
# Clone the repository
git clone https://github.com/passer-byzhang/ArtEpoch.git
cd ArtEpoch

# Install frontend dependencies
cd frontend
pnpm install

# Run development server
pnpm dev
```

Visit `http://localhost:3000` to play!

### Deploy Your Own Contract

```bash
cd contracts
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your PRIVATE_KEY and SEPOLIA_RPC_URL

# Deploy
npx hardhat run scripts/deploy.ts --network sepolia

# Initialize artworks with encrypted years
npx hardhat run scripts/initArtworks.ts --network sepolia

# Verify on Etherscan
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

---

## 🧪 Testing

### Run Tests

```bash
cd contracts
pnpm install
npx hardhat test
```

### Test Results

```
  ArtEpoch
    Deployment
      ✔ Should set the correct owner
      ✔ Should initialize with zero artworks
      ✔ Should initialize with zero guesses
    Access Control
      ✔ Should reject addArtwork from non-owner
    Artwork Management
      ✔ Should reject duplicate artwork IDs
      ✔ Should track artwork existence correctly
    Guess Management
      ✔ Should return zero guess count for new players
      ✔ Should reject guess for non-existent artwork
    View Functions
      ✔ Should revert getLatestGuessResult for player with no guesses
      ✔ Should revert getGuessResult for non-existent nonce
    Events
      ✔ Should emit ArtworkAdded event when artwork is added
      ✔ Should emit GuessSubmitted event when guess is submitted

  ArtEpoch - Integration Notes
    ✔ Documents FHE integration test results from Sepolia

  13 passing (1s)
```

> **Note:** Full FHE operations (encryption, computation, decryption) require deployment to Sepolia testnet with Zama FHEVM coprocessor. Local Hardhat tests verify contract logic, access control, and state management.

### On-Chain FHE Tests (Sepolia)

The following FHE operations have been verified on Sepolia testnet:

| Operation | Function | Status |
|-----------|----------|--------|
| Input Validation | `FHE.fromExternal()` | ✅ Verified |
| Encrypted Subtraction | `FHE.sub()` | ✅ Verified |
| Encrypted Comparison | `FHE.gt()` | ✅ Verified |
| Encrypted Conditional | `FHE.select()` | ✅ Verified |
| ACL Permission | `FHE.allow()` | ✅ Verified |

Example transactions:
- addArtwork: [`0x669c7a85...`](https://sepolia.etherscan.io/tx/0x669c7a856a446103ad9d3aec62bc9decf9d5f612ff5c9d59fcd4b59116c678f8)
- submitGuess: [`0x54624832...`](https://sepolia.etherscan.io/tx/0x546248324befe5ec61619a99953b29af3afc459ae12b58849a8e01718aebb6d1)

---

## 📁 Project Structure

```
ArtEpoch/
├── contracts/
│   ├── contracts/
│   │   └── ArtEpoch.sol          # FHE-enabled smart contract
│   ├── scripts/
│   │   ├── deploy.ts             # Deployment script
│   │   └── initArtworks.ts       # Initialize artworks on-chain
│   ├── test/
│   │   └── ArtEpoch.test.ts      # Unit tests
│   └── hardhat.config.ts
├── frontend/
│   ├── src/
│   │   ├── app/                  # Next.js pages
│   │   ├── components/           # React components (GameScreen, etc.)
│   │   ├── data/artworks.json    # Artwork metadata
│   │   └── lib/
│   │       ├── fheClient.ts      # FHE SDK wrapper
│   │       └── config.ts         # Contract ABI & addresses
│   └── public/artworks/          # Local artwork images
└── README.md
```

---

## 🎯 FHE Flow Diagram

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Frontend  │     │   Blockchain │     │  Zama Relayer   │
└─────────────┘     └──────────────┘     └─────────────────┘
       │                    │                     │
       │  1. Encrypt guess  │                     │
       │  (fheClient.encrypt16)                   │
       │────────────────────>                     │
       │                    │                     │
       │  2. Submit TX      │                     │
       │  (handle + proof)  │                     │
       │────────────────────>                     │
       │                    │                     │
       │                    │  3. FHE Compute     │
       │                    │  |guess - answer|   │
       │                    │  (all encrypted)    │
       │                    │                     │
       │  4. Get result handle                    │
       │<────────────────────                     │
       │                    │                     │
       │  5. Request decrypt (EIP-712 signature)  │
       │─────────────────────────────────────────>│
       │                    │                     │
       │  6. Decrypted value                      │
       │<─────────────────────────────────────────│
       │                    │                     │
       │  7. Display result │                     │
       │  "You were X years off!"                 │
```

---

## 💡 Business Potential

ArtEpoch demonstrates a pattern applicable to:

1. **Educational Platforms** — Partner with museums for gamified art education
2. **NFT Integration** — Mint achievement NFTs for accurate guesses
3. **Multiplayer Competitions** — Real-time tournaments with hidden guesses
4. **Confidential Quizzes** — Exams, certifications, trivia with anti-cheat
5. **Prediction Markets** — Hidden predictions revealed after deadline

---

## 📄 License

MIT License — Feel free to fork and build upon this project!

---

**Made with ❤️ using [Zama FHEVM](https://docs.zama.ai/fhevm)**
