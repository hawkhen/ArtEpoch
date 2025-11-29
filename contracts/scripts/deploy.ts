import { ethers } from "hardhat";

async function main() {
  console.log("Deploying ArtEpoch contract...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  const ArtEpoch = await ethers.getContractFactory("ArtEpoch");
  const artEpoch = await ArtEpoch.deploy();

  await artEpoch.waitForDeployment();

  const contractAddress = await artEpoch.getAddress();
  console.log("ArtEpoch deployed to:", contractAddress);

  console.log("\n--- Deployment Summary ---");
  console.log("Contract:", contractAddress);
  console.log("Deployer:", deployer.address);
  console.log("Network: Sepolia");
  console.log("\nTo verify on Etherscan:");
  console.log(`npx hardhat verify --network sepolia ${contractAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

