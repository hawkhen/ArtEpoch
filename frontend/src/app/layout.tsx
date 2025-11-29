import type { Metadata } from "next";
import { Playfair_Display, Cormorant_Garamond } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ArtEpoch | On-Chain Art Guessing Game",
  description: "Guess the year of famous artworks. Answers encrypted on-chain with FHE. Fair play guaranteed by Zama FHEVM.",
  keywords: ["art", "blockchain", "FHE", "Zama", "guessing game", "museum"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${playfair.variable} ${cormorant.variable} antialiased bg-[#0A0A0A] text-[#F5F5F0] min-h-screen`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
