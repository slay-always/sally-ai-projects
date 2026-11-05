
export enum Difficulty {
  EASY = 'Easy',
  MEDIUM = 'Medium',
  HARD = 'Hard'
}

export interface DictionaryEntry {
  id: string;
  word: string;
  pinyin: string;
  definition: string;
  tone: string;
  practicalExample: string;
  funnyExample: string;
  difficulty?: Difficulty;
}

export interface LyricLine {
  line: string;
  pinyin: string;
  translation: string;
}

export interface SongLyrics {
  id: string;
  title: string;
  pinyin?: string;
  englishTitle?: string;
  artist: string;
  lyrics: LyricLine[];
  explanation: string;
}

export interface HSKQuestion {
  id: string;
  level: number;
  question: string;
  pinyin?: string;
  options: string[];
  answer: number; // Index of the correct option
  explanation?: string;
  audioText?: string; // Text to be read for listening questions
  userAnswer?: number; // Added to store the user's choice when saved
}

export interface Scenario {
  id: string;
  title: string;
  hskLevel?: number; // Added HSK Level
  videoId?: string;
  videoUrl?: string;
  subtitles: {
    start: number;
    end: number;
    tokens: string[];
    translation: string;
  }[];
  cultureTips: {
    timestamp: number;
    title: string;
    description: string;
  }[];
}

export interface AppData {
  feed: Scenario[];
  hsk: HSKQuestion[];
}
