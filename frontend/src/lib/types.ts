export interface Artwork {
  id: number;
  title: string;
  artist: string;
  year: number;
  type: string;
  imageUrl: string;
  source: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface GameState {
  status: "idle" | "playing" | "submitting" | "result";
  currentArtwork: Artwork | null;
  guess: number | null;
  result: number | null;
  roundId: number | null;
}

export interface GuessResult {
  difference: number;
  timestamp: number;
}

