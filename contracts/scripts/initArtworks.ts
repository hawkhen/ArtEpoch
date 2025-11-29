import { ethers } from "hardhat";
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";
import artworksData from "../../frontend/src/data/artworks.json";

// Contract address on Sepolia (v3)
const CONTRACT_ADDRESS = "0x555D3Ed18c687EAf09B3087Cc847EEE33cf87208";

async function main() {
  console.log("Initializing artworks with encrypted years...\n");

  const [owner] = await ethers.getSigners();
  console.log("Owner address:", owner.address);

  const balance = await ethers.provider.getBalance(owner.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH\n");

  // Get contract
  const ArtEpoch = await ethers.getContractFactory("ArtEpoch");
  const artEpoch = ArtEpoch.attach(CONTRACT_ADDRESS);

  // Initialize FHEVM SDK
  console.log("Initializing FHEVM SDK...");
  // Use SepoliaConfig directly - it has the relayer URL built in
  const fhevm = await createInstance(SepoliaConfig);
  console.log("FHEVM SDK initialized\n");

  // Helper to convert bytes to hex
  const toHex = (bytes: Uint8Array): `0x${string}` => {
    return ("0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
  };

  // Process artworks one by one
  let successCount = 0;
  let skipCount = 0;

  for (const artwork of artworksData) {
    try {
      // Check if artwork already exists
      const exists = await artEpoch.artworkExists(artwork.id);
      if (exists) {
        console.log(`⏭️  Artwork #${artwork.id} already exists, skipping`);
        skipCount++;
        continue;
      }

      console.log(`\n📦 Adding Artwork #${artwork.id}: "${artwork.title}" (${artwork.year})`);

      // Encrypt the year
      const input = fhevm.createEncryptedInput(CONTRACT_ADDRESS, owner.address);
      input.add16(BigInt(artwork.year));
      const encrypted = await input.encrypt();

      const encryptedYear = toHex(encrypted.handles[0]);
      const inputProof = toHex(encrypted.inputProof);

      // Send transaction
      const tx = await artEpoch.addArtwork(artwork.id, encryptedYear, inputProof);
      console.log(`   TX: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`   ✅ Confirmed in block ${receipt?.blockNumber}`);
      
      successCount++;

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 1000));
    } catch (error: any) {
      console.error(`   ❌ Failed: ${error.message}`);
    }
  }

  console.log("\n========================================");
  console.log(`✅ Successfully added: ${successCount} artworks`);
  console.log(`⏭️  Skipped (already exist): ${skipCount} artworks`);
  console.log(`📊 Total artworks in contract: ${await artEpoch.totalArtworks()}`);
  console.log("========================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

