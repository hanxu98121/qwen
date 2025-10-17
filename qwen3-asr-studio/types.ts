
export enum ApiProvider {
  MODELSCOPE = 'modelscope',
  BAILIAN = 'bailian',
  DOUBAO = 'doubao',
}

export enum Language {
  AUTO = "auto",
  CHINESE = "zh",
  ENGLISH = "en",
  JAPANESE = "ja",
  KOREAN = "ko",
  SPANISH = "es",
  FRENCH = "fr",
  GERMAN = "de",
  ARABIC = "ar",
  ITALIAN = "it",
  RUSSIAN = "ru",
  PORTUGUESE = "pt",
}

export enum CompressionLevel {
  ORIGINAL = 'original',
  MEDIUM = 'medium',
  MINIMUM = 'minimum',
}

export interface HistoryItem {
  id: number;
  fileName: string;
  transcription: string;
  detectedLanguage: string;
  context: string;
  timestamp: number;
  audioFile: File;
}

export interface NoteItem {
  id: number;
  content: string;
  timestamp: number;
}
