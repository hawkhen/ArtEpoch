/**
 * FHE Client - Based on 0xNana/fhevm-react-template Universal SDK
 * https://github.com/0xNana/fhevm-react-template
 * 
 * Uses CDN to load @zama-fhe/relayer-sdk v0.3.0-5
 */

// CDN URL for the SDK (same as 0xNana template)
const SDK_CDN_URL = "https://cdn.zama.org/relayer-sdk-js/0.3.0-5/relayer-sdk-js.umd.cjs";

// ============ Types ============

export interface EncryptedInput {
  handles: Uint8Array[];
  inputProof: Uint8Array;
}

export interface DecryptParams {
  handle: string | Uint8Array;
  contractAddress: string;
}

interface FhevmInstance {
  createEncryptedInput: (contractAddress: string, userAddress: string) => {
    add16: (value: bigint) => void;
    encrypt: () => Promise<EncryptedInput>;
  };
  generateKeypair: () => { publicKey: string; privateKey: string };
  createEIP712: (
    publicKey: string,
    contractAddresses: string[],
    startTimestamp: number,
    durationDays: number
  ) => {
    domain: Record<string, unknown>;
    types: { UserDecryptRequestVerification: { name: string; type: string }[] };
    message: Record<string, unknown>;
  };
  userDecrypt: (
    handles: { handle: string; contractAddress: string }[],
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: number,
    durationDays: number
  ) => Promise<Record<string, bigint>>;
  getPublicKey: () => string;
  getPublicParams: (size: number) => unknown;
}

interface RelayerSDK {
  initSDK: (options?: { tfheParams?: string; kmsParams?: string }) => Promise<boolean>;
  createInstance: (config: unknown) => Promise<FhevmInstance>;
  SepoliaConfig: {
    relayerUrl: string;
    chainId: number;
    aclContractAddress: string;
    [key: string]: unknown;
  };
  ZamaEthereumConfig?: unknown;
  __initialized__?: boolean;
}

declare global {
  interface Window {
    relayerSDK?: RelayerSDK;
    RelayerSDK?: RelayerSDK;
  }
}

// ============ FHE Client Class ============

class FheClient {
  private instance: FhevmInstance | null = null;
  private initPromise: Promise<FhevmInstance> | null = null;
  private _status: "idle" | "loading" | "ready" | "error" = "idle";
  private _error: string | null = null;

  get status() { return this._status; }
  get error() { return this._error; }

  async init(): Promise<FhevmInstance> {
    if (this.instance && this._status === "ready") return this.instance;
    if (this.initPromise) return this.initPromise;

    this._status = "loading";
    this._error = null;
    this.initPromise = this._doInit();
    return this.initPromise;
  }

  private async _doInit(): Promise<FhevmInstance> {
    if (typeof window === "undefined") {
      throw new Error("FHE SDK requires browser environment");
    }

    try {
      console.log("[FheClient] Loading SDK from CDN...");
      
      // Step 1: Load SDK via script tag
      await this._loadSDK();
      
      const sdk = window.relayerSDK || window.RelayerSDK;
      if (!sdk) {
        throw new Error("SDK not found on window after loading");
      }
      
      // Store in expected location
      window.relayerSDK = sdk;
      
      console.log("[FheClient] SDK loaded, initializing WASM...");
      
      // Step 2: Initialize SDK (WASM)
      if (!sdk.__initialized__) {
        const result = await sdk.initSDK();
        if (!result) {
          throw new Error("SDK initialization returned false");
        }
        sdk.__initialized__ = true;
      }
      
      console.log("[FheClient] WASM initialized");
      
      // Step 3: Get config (prefer ZamaEthereumConfig for v0.9+, fallback to SepoliaConfig)
      const configBase = sdk.ZamaEthereumConfig || sdk.SepoliaConfig;
      if (!configBase) {
        throw new Error("Neither ZamaEthereumConfig nor SepoliaConfig found");
      }
      
      console.log("[FheClient] Using config:", {
        relayerUrl: (configBase as { relayerUrl?: string }).relayerUrl,
        chainId: (configBase as { chainId?: number }).chainId,
      });
      
      // Step 4: Create instance
      const config = {
        ...configBase,
        network: window.ethereum,
      };
      
      this.instance = await sdk.createInstance(config);
      this._status = "ready";
      
      console.log("[FheClient] Ready ✅");
      return this.instance;
      
    } catch (error) {
      console.error("[FheClient] Init failed:", error);
      this._status = "error";
      this._error = error instanceof Error ? error.message : "Unknown error";
      this.initPromise = null;
      throw error;
    }
  }

  private _loadSDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      const existingSdk = window.relayerSDK || window.RelayerSDK;
      if (existingSdk && this._isValidSDK(existingSdk)) {
        window.relayerSDK = existingSdk;
        console.log("[FheClient] SDK already loaded");
        resolve();
        return;
      }

      // Check if script already exists
      const existingScript = document.querySelector(`script[src="${SDK_CDN_URL}"]`);
      if (existingScript) {
        // Wait for it to load
        this._waitForSDK(resolve, reject);
        return;
      }

      // Create and load script
      const script = document.createElement("script");
      script.src = SDK_CDN_URL;
      script.type = "text/javascript";
      script.async = true;

      script.onload = () => {
        const sdk = window.relayerSDK || window.RelayerSDK;
        if (!sdk || !this._isValidSDK(sdk)) {
          reject(new Error("SDK loaded but validation failed"));
          return;
        }
        window.relayerSDK = sdk;
        console.log("[FheClient] SDK script loaded");
        resolve();
      };

      script.onerror = () => {
        reject(new Error(`Failed to load SDK from ${SDK_CDN_URL}`));
      };

      document.head.appendChild(script);
    });
  }

  private _waitForSDK(resolve: () => void, reject: (err: Error) => void): void {
    let attempts = 0;
    const maxAttempts = 100; // 5 seconds max
    
    const check = () => {
      const sdk = window.relayerSDK || window.RelayerSDK;
      if (sdk && this._isValidSDK(sdk)) {
        window.relayerSDK = sdk;
        resolve();
        return;
      }
      
      attempts++;
      if (attempts >= maxAttempts) {
        reject(new Error("Timeout waiting for SDK to load"));
        return;
      }
      
      setTimeout(check, 50);
    };
    
    check();
  }

  private _isValidSDK(sdk: unknown): sdk is RelayerSDK {
    if (!sdk || typeof sdk !== "object") return false;
    const s = sdk as Record<string, unknown>;
    return (
      typeof s.initSDK === "function" &&
      typeof s.createInstance === "function" &&
      (typeof s.SepoliaConfig === "object" || typeof s.ZamaEthereumConfig === "object")
    );
  }

  getInstance(): FhevmInstance {
    if (!this.instance) throw new Error("FheClient not initialized");
    return this.instance;
  }

  async encrypt16(value: number, contractAddress: string, userAddress: string): Promise<EncryptedInput> {
    const instance = this.getInstance();
    const input = instance.createEncryptedInput(contractAddress, userAddress);
    input.add16(BigInt(value));
    const encrypted = await input.encrypt();
    console.log("[FheClient] Encrypted value:", value);
    return encrypted;
  }

  /**
   * Decrypt using EIP-712 signature (based on FhevmDecryptionSignature pattern)
   */
  async decrypt(
    handles: DecryptParams[],
    signer: {
      getAddress: () => Promise<string>;
      signTypedData: (domain: unknown, types: unknown, message: unknown) => Promise<string>;
    }
  ): Promise<Record<string, bigint>> {
    const instance = this.getInstance();
    const userAddress = await signer.getAddress();
    
    // Generate keypair for decryption
    const { publicKey, privateKey } = instance.generateKeypair();
    
    // Get contract addresses
    const contractAddresses = [...new Set(handles.map(h => h.contractAddress))];
    
    // Create EIP-712 message
    const startTimestamp = Math.floor(Date.now() / 1000);
    const durationDays = 1;
    
    const eip712 = instance.createEIP712(publicKey, contractAddresses, startTimestamp, durationDays);
    
    console.log("[FheClient] Requesting EIP-712 signature...");
    
    // Sign with wallet
    const signature = await signer.signTypedData(
      eip712.domain,
      { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
      eip712.message
    );
    
    console.log("[FheClient] Signature obtained, decrypting...");
    
    // Prepare handles
    const handlePairs = handles.map(h => ({
      handle: typeof h.handle === "string" ? h.handle : this._toHex(h.handle as Uint8Array),
      contractAddress: h.contractAddress,
    }));
    
    // Call userDecrypt
    const results = await instance.userDecrypt(
      handlePairs,
      privateKey,
      publicKey,
      signature,
      contractAddresses,
      userAddress,
      startTimestamp,
      durationDays
    );
    
    console.log("[FheClient] Decryption successful");
    return results;
  }

  private _toHex(bytes: Uint8Array): string {
    return "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  getHandleHex(encrypted: EncryptedInput): `0x${string}` {
    return this._toHex(encrypted.handles[0]) as `0x${string}`;
  }

  getProofHex(encrypted: EncryptedInput): `0x${string}` {
    return this._toHex(encrypted.inputProof) as `0x${string}`;
  }
}

export const fheClient = new FheClient();
