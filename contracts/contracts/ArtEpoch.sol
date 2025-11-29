// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint16, ebool, externalEuint16 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ArtEpoch - On-chain art guessing game with FHE
/// @notice Guess the creation year of artworks, verified with FHE encryption
/// @dev Stores encrypted years for multiple artworks, allows unlimited guesses
contract ArtEpoch is ZamaEthereumConfig, Ownable {
    
    // ============ Structs ============
    
    struct Artwork {
        euint16 encryptedYear;      // Encrypted correct year
        bool exists;                // Whether artwork is initialized
    }
    
    struct GuessResult {
        euint16 encryptedDiff;      // Encrypted difference |guess - answer|
        uint256 timestamp;          // Guess timestamp
    }
    
    // ============ State Variables ============
    
    // artworkId => Artwork data
    mapping(uint256 => Artwork) public artworks;
    
    // nonce for each user to allow multiple guesses (artworkId => user => nonce => result)
    mapping(uint256 => mapping(address => mapping(uint256 => GuessResult))) public guessResults;
    
    // Track user's guess count per artwork
    mapping(uint256 => mapping(address => uint256)) public guessCount;
    
    uint256 public totalArtworks;
    uint256 public totalGuesses;
    
    // ============ Events ============
    
    event ArtworkAdded(uint256 indexed artworkId, uint256 timestamp);
    event GuessSubmitted(uint256 indexed artworkId, address indexed player, uint256 nonce, uint256 timestamp);
    
    // ============ Constructor ============
    
    constructor() Ownable(msg.sender) {}
    
    // ============ Admin Functions ============
    
    /// @notice Add an artwork with encrypted year
    /// @param artworkId The ID of the artwork (matches frontend JSON)
    /// @param encryptedYear The encrypted correct year
    /// @param inputProof The proof for the encrypted input
    function addArtwork(
        uint256 artworkId,
        externalEuint16 encryptedYear,
        bytes calldata inputProof
    ) external onlyOwner {
        require(!artworks[artworkId].exists, "Artwork already exists");
        
        euint16 year = FHE.fromExternal(encryptedYear, inputProof);
        
        artworks[artworkId] = Artwork({
            encryptedYear: year,
            exists: true
        });
        
        // Allow contract to use this encrypted value
        FHE.allowThis(year);
        
        totalArtworks++;
        
        emit ArtworkAdded(artworkId, block.timestamp);
    }
    
    /// @notice Batch add multiple artworks
    /// @param artworkIds Array of artwork IDs
    /// @param encryptedYears Array of encrypted years
    /// @param inputProofs Array of proofs
    function addArtworksBatch(
        uint256[] calldata artworkIds,
        externalEuint16[] calldata encryptedYears,
        bytes[] calldata inputProofs
    ) external onlyOwner {
        require(artworkIds.length == encryptedYears.length, "Length mismatch");
        require(artworkIds.length == inputProofs.length, "Length mismatch");
        
        for (uint256 i = 0; i < artworkIds.length; i++) {
            if (!artworks[artworkIds[i]].exists) {
                euint16 year = FHE.fromExternal(encryptedYears[i], inputProofs[i]);
                
                artworks[artworkIds[i]] = Artwork({
                    encryptedYear: year,
                    exists: true
                });
                
                FHE.allowThis(year);
                totalArtworks++;
                
                emit ArtworkAdded(artworkIds[i], block.timestamp);
            }
        }
    }
    
    // ============ Player Functions ============
    
    /// @notice Submit a guess for an artwork (unlimited guesses allowed)
    /// @param artworkId The artwork to guess on
    /// @param encryptedGuess The encrypted guess year
    /// @param inputProof The proof for the encrypted input
    /// @return nonce The nonce of this guess (for retrieving result)
    function submitGuess(
        uint256 artworkId,
        externalEuint16 encryptedGuess,
        bytes calldata inputProof
    ) external returns (uint256 nonce) {
        require(artworks[artworkId].exists, "Artwork not found");
        
        euint16 guess = FHE.fromExternal(encryptedGuess, inputProof);
        euint16 answer = artworks[artworkId].encryptedYear;
        
        // Calculate absolute difference: |guess - answer|
        euint16 diff1 = FHE.sub(guess, answer);
        euint16 diff2 = FHE.sub(answer, guess);
        ebool guessGreater = FHE.gt(guess, answer);
        euint16 absDiff = FHE.select(guessGreater, diff1, diff2);
        
        // Get current nonce and increment
        nonce = guessCount[artworkId][msg.sender];
        guessCount[artworkId][msg.sender]++;
        
        // Store the result
        guessResults[artworkId][msg.sender][nonce] = GuessResult({
            encryptedDiff: absDiff,
            timestamp: block.timestamp
        });
        
        // Allow the player to decrypt their result
        FHE.allow(absDiff, msg.sender);
        FHE.allowThis(absDiff);
        
        totalGuesses++;
        
        emit GuessSubmitted(artworkId, msg.sender, nonce, block.timestamp);
        
        return nonce;
    }
    
    // ============ View Functions ============
    
    /// @notice Get the encrypted difference for a player's guess
    /// @param artworkId The artwork ID
    /// @param player The player's address
    /// @param nonce The guess nonce
    /// @return The encrypted handle of the difference
    function getGuessResult(uint256 artworkId, address player, uint256 nonce) external view returns (euint16) {
        require(guessResults[artworkId][player][nonce].timestamp > 0, "No guess found");
        return guessResults[artworkId][player][nonce].encryptedDiff;
    }
    
    /// @notice Get the latest guess result for a player
    /// @param artworkId The artwork ID
    /// @param player The player's address
    /// @return The encrypted handle of the latest difference
    function getLatestGuessResult(uint256 artworkId, address player) external view returns (euint16) {
        uint256 count = guessCount[artworkId][player];
        require(count > 0, "No guess found");
        return guessResults[artworkId][player][count - 1].encryptedDiff;
    }
    
    /// @notice Check if an artwork exists
    /// @param artworkId The artwork ID
    /// @return Whether the artwork exists
    function artworkExists(uint256 artworkId) external view returns (bool) {
        return artworks[artworkId].exists;
    }
    
    /// @notice Get guess count for a player on an artwork
    /// @param artworkId The artwork ID
    /// @param player The player's address
    /// @return The number of guesses
    function getGuessCount(uint256 artworkId, address player) external view returns (uint256) {
        return guessCount[artworkId][player];
    }
}
