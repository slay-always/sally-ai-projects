
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Play, 
  Search, 
  BookMarked, 
  ChevronRight, 
  Volume2, 
  Lightbulb, 
  Heart, 
  Loader2, 
  GraduationCap, 
  PhoneOff, 
  Waves, 
  Apple,
  Trash2,
  ChevronLeft,
  MicOff,
  Sparkles,
  Zap,
  ChevronDown,
  ChevronUp,
  VolumeX,
  RefreshCw,
  AlertCircle,
  Music,
  ListMusic,
  Bookmark,
  Quote,
  Layers,
  Info,
  ExternalLink
} from 'lucide-react';
import { GoogleGenAI, Modality, LiveServerMessage, Blob, Type, GenerateContentResponse } from "@google/genai";
import { DictionaryEntry, Scenario, HSKQuestion, SongLyrics, LyricLine } from './types';

// --- Storage Keys ---
const STORAGE_KEY_VOCAB = 'slay_notebook_vocab';
const STORAGE_KEY_MISTAKES = 'slay_notebook_mistakes';
const STORAGE_KEY_SONGS = 'slay_saved_songs';

// --- Custom Icons ---
const GoogleLensIcon = ({ size = 22, color = "#6495ED" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Minimalist Camera Body matching the user's provided image */}
    <path 
      d="M19 19H5C3.89543 19 3 18.1046 3 17V9C3 7.89543 3.89543 7 5 7H7.5L9.5 4H14.5L16.5 7H19C20.1046 7 21 7.89543 21 9V17C21 18.1046 20.1046 19 19 19Z" 
      stroke={color} 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    {/* Center Lens */}
    <circle cx="12" cy="13" r="3.2" stroke={color} strokeWidth="2.5"/>
    {/* Bottom Right Sensor Dot */}
    <circle cx="17.5" cy="16.5" r="1.2" fill={color}/>
  </svg>
);
// --- CRITICAL UTILITY: Robust JSON Extraction ---
function extractJson(text: string) {
  try {
    const cleanedText = text.replace(/\[\d+(?:,\s*\d+)*\]/g, '');
    const match = cleanedText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
  } catch (e) {
    console.error("JSON Extraction Error:", e);
    try {
      if (text.trim().endsWith('}') || text.trim().endsWith(']')) throw e;
      const lastOpenBrace = text.lastIndexOf('{');
      const lastOpenBracket = text.lastIndexOf('[');
      let fixedText = text;
      if (lastOpenBracket > lastOpenBrace) fixedText += ']';
      else fixedText += '}';
      const matchFixed = fixedText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (matchFixed) return JSON.parse(matchFixed[0]);
    } catch (innerE) {
      console.error("Fixed JSON also failed:", innerE);
    }
  }
  return null;
}

// --- Audio Helpers ---
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) int16[i] = data[i] * 32768;
  return { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
}

// Portfolio copy: credentials are supplied locally and are never committed.
function createAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API is not configured in this portfolio copy.');
  return new GoogleGenAI({ apiKey });
}

// --- GEMINI NATIVE TTS ---
const geminiSpeak = async (text: string, voiceName: 'Kore' | 'Puck' | 'Zephyr' = 'Kore') => {
  try {
    const ai = createAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Read this Chinese text clearly: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const buffer = await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start();
      return true;
    }
    return false;
  } catch (error) { return false; }
};

const nativeSpeakFallback = (text: string, onEnd?: () => void) => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.8; 
    if (onEnd) utterance.onend = onEnd;
    window.speechSynthesis.speak(utterance);
  }
};

const slaySpeak = async (text: string, onEnd?: () => void) => {
  const success = await geminiSpeak(text);
  if (!success) nativeSpeakFallback(text, onEnd);
  else if (onEnd) setTimeout(onEnd, text.length * 400); 
};

// --- UI Components ---
const ListeningBar: React.FC<{ text: string }> = ({ text }) => {
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef<number | null>(null);

  const startPlayback = () => {
    if (isPlaying) return;
    setIsPlaying(true); setProgress(0);
    const estimatedDuration = text.length * 400; 
    const step = 100 / (estimatedDuration / 50); 
    slaySpeak(text, () => {
      setIsPlaying(false); setProgress(100);
      if (timerRef.current) clearInterval(timerRef.current);
    });
    timerRef.current = window.setInterval(() => {
      setProgress(prev => prev >= 100 ? 100 : prev + step);
    }, 50);
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); window.speechSynthesis.cancel(); }, []);

  return (
    <div className="flex items-center gap-3 bg-blue-50/50 p-4 rounded-2xl mb-6">
      <button onClick={startPlayback} className={`p-3 rounded-full transition-all ${isPlaying ? 'bg-[#6495ED] text-white animate-pulse' : 'bg-white text-[#6495ED] shadow-sm active:scale-90'}`}>
        <Volume2 size={24} />
      </button>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-[#6495ED] transition-all duration-75" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

const TypingPlaceholder: React.FC<{ phrases: string[] }> = ({ phrases }) => {
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [loopNum, setLoopNum] = useState(0);
  const [typingSpeed, setTypingSpeed] = useState(100);

  useEffect(() => {
    let timer = setTimeout(() => {
      const i = loopNum % phrases.length;
      const fullText = phrases[i];
      if (isDeleting) {
        setDisplayText(fullText.substring(0, displayText.length - 1));
        setTypingSpeed(40);
      } else {
        setDisplayText(fullText.substring(0, displayText.length + 1));
        setTypingSpeed(100);
      }
      if (!isDeleting && displayText === fullText) setTimeout(() => setIsDeleting(true), 2000); 
      else if (isDeleting && displayText === "") { setIsDeleting(false); setLoopNum(loopNum + 1); }
    }, typingSpeed);
    return () => clearTimeout(timer);
  }, [displayText, isDeleting, loopNum, phrases, typingSpeed]);

  return <span className="inline-block min-h-[1.5em]">{displayText}<span className="animate-pulse">|</span></span>;
};

const renderExampleSentence = (example: string) => {
  const parts = example.split('|').map(p => p.trim());
  if (parts.length >= 3) {
    return (
      <div className="space-y-1">
        <p className="text-gray-900 font-bold text-lg leading-tight">{parts[0]}</p>
        <p className="text-[#6495ED] font-mono text-[10px] font-black">{parts[1]}</p>
        <p className="text-gray-500 font-medium text-[11px] italic">"{parts[2]}"</p>
      </div>
    );
  }
  return <p className="text-gray-800 font-bold leading-snug">{example}</p>;
};

const DictionaryModal: React.FC<{ 
  entry: DictionaryEntry | null; 
  isLoading: boolean; 
  isSaved: boolean;
  onClose: () => void; 
  onSave: (e: DictionaryEntry) => void 
}> = ({ entry, isLoading, isSaved, onClose, onSave }) => {
  if (!entry && !isLoading) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-[32px] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300 min-h-[400px] relative" onClick={e => e.stopPropagation()}>
        {isLoading ? (
          <div className="h-[400px] flex flex-col items-center justify-center space-y-4">
            <Loader2 className="animate-spin text-[#6495ED]" size={48} />
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">slay is loading...</p>
          </div>
        ) : entry && (
          <div className="p-8">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-4xl font-extrabold text-gray-900 mb-1">{entry.word}</h2>
                <div className="flex flex-col gap-1">
                  <p className="text-[#6495ED] font-mono text-lg font-bold leading-none">{entry.pinyin}</p>
                  <span className="w-fit px-2 py-0.5 rounded-md bg-orange-100 text-orange-600 text-[10px] font-black uppercase">{entry.tone || 'Tones'}</span>
                </div>
              </div>
              <button onClick={() => slaySpeak(entry.word)} className="p-3 bg-blue-50 text-[#6495ED] rounded-2xl hover:bg-blue-100 transition-colors active:scale-95">
                <Volume2 size={28} />
              </button>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">English Definition</h4>
                <p className="text-base text-gray-800 font-medium leading-tight">{entry.definition}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                <div>
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Usage Example 1</h4>
                  {renderExampleSentence(entry.practicalExample)}
                </div>
                {entry.funnyExample && (
                  <div className="pt-3 border-t border-gray-200">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Usage Example 2</h4>
                    {renderExampleSentence(entry.funnyExample)}
                  </div>
                )}
              </div>
            </div>
            <button onClick={() => onSave(entry)} disabled={isSaved} className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${isSaved ? 'bg-gray-100 text-gray-400 cursor-default' : 'bg-[#6495ED] text-white hover:bg-blue-600 shadow-blue-200'}`}>
              <Heart size={20} fill={isSaved ? "currentColor" : "none"} />
              {isSaved ? 'Saved in Notebook' : 'Save to Notebook'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [currentTab, setCurrentTab] = useState('feed');
  const [activeWord, setActiveWord] = useState<DictionaryEntry | null>(null);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<DictionaryEntry[]>([]);
  const [savedWords, setSavedWords] = useState<DictionaryEntry[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEY_VOCAB) || '[]'));
  const [mistakes, setMistakes] = useState<HSKQuestion[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEY_MISTAKES) || '[]'));
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [isSearchingLyrics, setIsSearchingLyrics] = useState(false);
  const [fetchingSongId, setFetchingSongId] = useState<string | null>(null);
  const [songListResults, setSongListResults] = useState<{title: string, englishTitle: string, pinyin: string, artist: string}[]>([]);
  const [currentSong, setCurrentSong] = useState<SongLyrics | null>(null);
  const [savedSongs, setSavedSongs] = useState<SongLyrics[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEY_SONGS) || '[]'));
  const [isSavedFeedView, setIsSavedFeedView] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isStreamingLyrics, setIsStreamingLyrics] = useState(false);
  const [feedData, setFeedData] = useState<Scenario[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [practiceMode, setPracticeMode] = useState<'selection' | 'exam' | 'review'>('selection');
  const [currentExamQuestions, setCurrentExamQuestions] = useState<HSKQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [expandedMistakes, setExpandedMistakes] = useState<Set<string>>(new Set());
  const [notebookView, setNotebookView] = useState<'vocabulary' | 'questions'>('vocabulary');
  const [isFlashcardMode, setIsFlashcardMode] = useState(false);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<'Idle' | 'Connecting' | 'Active' | 'Listening' | 'Speaking' | 'TurnComplete'>('Idle');
  const [visualVolume, setVisualVolume] = useState(0);
  const [flashcardExplanationVisible, setFlashcardExplanationVisible] = useState(false);
  const [isFlashcardAudioPlaying, setIsFlashcardAudioPlaying] = useState(false);
  const [groundingSources, setGroundingSources] = useState<any[]>([]);
  const [isImageProcessing, setIsImageProcessing] = useState(false);

  
  const liveSessionRef = useRef<any>(null);
  const isClosingRef = useRef<boolean>(false);
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);


  // --- Gesture Support ---
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const gestureDirection = useRef<'none' | 'horizontal' | 'vertical'>('none');
  const [dragOffset, setDragOffset] = useState(0);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (exitDirection) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    gestureDirection.current = 'none';
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // if (touchStartX.current === null) return;
    if (touchStartX.current === null || touchStartY.current === null || exitDirection) return;

    // If we've already locked onto vertical scrolling, don't do anything
    if (gestureDirection.current === 'vertical') return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartX.current;
    const deltaY = currentY - touchStartY.current;

    // Detect direction on initial movement
    if (gestureDirection.current === 'none') {
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
        gestureDirection.current = 'vertical';
        return;
      } else if (Math.abs(deltaX) > 10) {
        gestureDirection.current = 'horizontal';
      }
    }
    if (gestureDirection.current === 'horizontal') {
      setDragOffset(deltaX);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent, maxIndex: number) => {
    if (touchStartX.current === null || exitDirection) return;
    if (gestureDirection.current === 'horizontal') {
      const threshold = 120; // 挪走多少像素算切换
    if (dragOffset > threshold && flashcardIndex > 0) {
      // 往右挪 -> 前一张
      setExitDirection('right');
      setTimeout(() => {
        setFlashcardIndex(prev => prev - 1);
        setExitDirection(null);
        setDragOffset(0);
        setFlashcardExplanationVisible(false);
      }, 400); 
    } else if (dragOffset < -threshold && flashcardIndex < maxIndex) {
      // 往左挪 -> 下一张
      setExitDirection('left');
      setTimeout(() => {
        setFlashcardIndex(prev => prev + 1);
        setExitDirection(null);
        setDragOffset(0);
        setFlashcardExplanationVisible(false);
    }, 400);
  } else {
    setDragOffset(0);
  }
  } else {
    setDragOffset(0); 
  }// 无论是否切换，松开手都归零
    touchStartX.current = null;
    touchStartY.current = null;
    gestureDirection.current = 'none';
  };

  useEffect(() => { localStorage.setItem(STORAGE_KEY_VOCAB, JSON.stringify(savedWords)); }, [savedWords]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_MISTAKES, JSON.stringify(mistakes)); }, [mistakes]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_SONGS, JSON.stringify(savedSongs)); }, [savedSongs]);

  useEffect(() => {
    (async () => {
      setIsDataLoading(true);
      try {
        const res = await fetch('./feed.json');
        if (res.ok) setFeedData(await res.json());
      } catch (err) {} finally { setIsDataLoading(false); }
    })();
  }, []);

  const stopVoiceSession = () => {
    isClosingRef.current = true;
    if (liveSessionRef.current) { liveSessionRef.current.close(); liveSessionRef.current = null; }
    if (audioContextInRef.current) { audioContextInRef.current.close().catch(() => {}); audioContextInRef.current = null; }
    if (audioContextOutRef.current) { audioContextOutRef.current.close().catch(() => {}); audioContextOutRef.current = null; }
    audioSourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    audioSourcesRef.current.clear();
    setIsVoiceActive(false); setVoiceStatus('Idle'); setVisualVolume(0); nextStartTimeRef.current = 0;
  };

  const handleSearchLyrics = async (manualQuery?:string) => {
    const targetQuery = manualQuery || songSearchQuery;

    if (!targetQuery.trim()) return;
    
    setIsSearchingLyrics(true); 
    setCurrentSong(null); 
    setSongListResults([]); 
    setSearchError(null); 
    setGroundingSources([]);

    //if (!songSearchQuery.trim()) return;
    //setIsSearchingLyrics(true); setCurrentSong(null); setSongListResults([]); setSearchError(null); setGroundingSources([]);
    try {
      const ai = createAI();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", 
        contents: `Search the web for ACTUAL, verified songs by real artists related to "${targetQuery}". 
        
        STRICT VERIFICATION PROTOCOL:
        1. Examine search snippets carefully. Only return an entry if the Artist Name is EXPLICITLY paired with the Song Title in the source text.
        2. DO NOT assume relevance because keywords appear in the same snippet.
        3. Factual Check: Does "Artist X" actually have a song called "Title Y"? 
        
        Return ONLY a JSON block:
        { "artistWorks": [{ "title": "Chinese Title", "pinyin": "pinyin", "englishTitle": "English Title", "artist": "Artist Name" }] }`,
        config: { 
          tools: [{googleSearch: {}}],
          thinkingConfig: { thinkingBudget: 0 }
        }
      });
      
      const data = extractJson(response.text || "");
      if (data && data.artistWorks?.length > 0) {
        setSongListResults(data.artistWorks || []);
        setGroundingSources(response.candidates?.[0]?.groundingMetadata?.groundingChunks || []);
      } else {
        setSearchError("No verified matches found.");
      }
      setIsSavedFeedView(false);
    } catch (e: any) { setSearchError("Search failed."); }
    finally { setIsSearchingLyrics(false); }
  };

  const handleVisualSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImageProcessing(true);
    setSearchError(null);
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64Data = (reader.result as string).split(',')[1];
        const ai = createAI();
        const response = await ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: {
            parts: [
              { inlineData: { data: base64Data, mimeType: file.type } },
              { text: "This is a screenshot of a music player. Extract the song title and artist name. Return ONLY a JSON block: { \"title\": \"...\", \"artist\": \"...\" }" }
            ]
          }
        });
        
        const data = extractJson(response.text || "");
        if (data && data.title) {
          const query = `${data.title} ${data.artist || ""}`.trim();
          setSongSearchQuery(query);
          await handleSearchLyrics(query);
        } else {
          setSearchError("Could not detect song information from the image.");
        }
      } catch (err) {
        setSearchError("Vision search failed.");
      } finally {
        setIsImageProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const fetchFullLyrics = async (song: {title: string, artist: string, pinyin: string, englishTitle?: string}) => {
    const uniqueId = `${song.title}-${song.artist}`;
    setFetchingSongId(uniqueId); setIsStreamingLyrics(true); setSearchError(null);
    
    const initialSong: SongLyrics = {
      id: `song-${Date.now()}`,
      title: song.title,
      pinyin: song.pinyin,
      artist: song.artist,
      englishTitle: song.englishTitle,
      lyrics: [],
      explanation: ""
    };
    setCurrentSong(initialSong);

    try {
      const ai = createAI();
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `Retrieve the COMPLETE, UNABRIDGED Chinese lyrics for "${song.title}" by "${song.artist}". 
        ZERO-TRUNCATION POLICY:
        1. You MUST provide every single line. Do not skip the "outro", "chorus repeats", or final sentences.
        2. Ensure the lyrics exactly match the performance by "${song.artist}".
        3. If you run out of tokens, prioritize finishing the lyrics over the explanation.
        4. The JSON must be perfectly valid and closed.
        Return ONLY a JSON block:
        {
          "lyrics": [{ "line": "Chinese text", "pinyin": "pinyin", "translation": "English translation" }],
          "explanation": "Vibe analysis."
        }`,
        config: { 
          tools: [{googleSearch: {}}], 
          maxOutputTokens: 16000,
          thinkingConfig: { thinkingBudget: 8000 }
        }
      });

      const data = extractJson(response.text || "");
      if (data && data.lyrics && data.lyrics.length > 0) {
        setCurrentSong(prev => prev ? { ...prev, lyrics: data.lyrics, explanation: data.explanation } : prev);
      } else {
        setSearchError("Could not retrieve lyrics.");
      }
    } catch (e: any) { setSearchError("Lyric retrieval error."); }
    finally { setFetchingSongId(null); setIsStreamingLyrics(false); }
  };

  const startVoiceSession = async () => {
    if (isVoiceActive) return;
        // SYNC INITIALIZATION: CRITICAL FOR ANDROID/SAMSUNG 
    // Create contexts IMMEDIATELY in the click event thread.
    const audioIn = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const audioOut = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    // Resume them synchronously before any async await calls.
    audioIn.resume(); 
    audioOut.resume();
    
    audioContextInRef.current = audioIn; 
    audioContextOutRef.current = audioOut;
    
    setVoiceStatus('Connecting'); 
    setIsVoiceActive(true); 
    isClosingRef.current = false;

    //setVoiceStatus('Connecting'); setIsVoiceActive(true); isClosingRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ai = createAI();
      // const audioIn = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      // const audioOut = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      // await audioIn.resume(); await audioOut.resume();
      audioContextInRef.current = audioIn; audioContextOutRef.current = audioOut;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: { 
          responseModalities: [Modality.AUDIO], 
          systemInstruction: "You are Slay, a chill, witty AI Chinese tutor.",
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } }
        },
        callbacks: {
          onopen: () => {
            setVoiceStatus('Active');
            const source = audioIn.createMediaStreamSource(stream);
            const processor = audioIn.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              if (isClosingRef.current || !liveSessionRef.current) return;
              const pcmBlob = createBlob(e.inputBuffer.getChannelData(0));
              sessionPromise.then(s => { if (!isClosingRef.current && s) s.sendRealtimeInput({ media: pcmBlob }); });
            };
            source.connect(processor); processor.connect(audioIn.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              const ctx = audioContextOutRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
              const source = ctx.createBufferSource(); source.buffer = buffer;
              source.connect(ctx.destination);
              source.start(nextStartTimeRef.current); nextStartTimeRef.current += buffer.duration;
              audioSourcesRef.current.add(source); setVoiceStatus('Speaking');
            }
          },
          onclose: () => stopVoiceSession(),
          onerror: (e) => stopVoiceSession()
        }
      });
      liveSessionRef.current = await sessionPromise;
    } catch (err: any) { 
      console.error("Live Session Start Error:", err);
      stopVoiceSession(); }
  };

  const handleLookup = async (token: string, context?: string) => {
    setIsModalLoading(true); setActiveWord(null);
    try {
      const ai = createAI();
      const res = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Explain "${token}" in context: "${context}". JSON: {word, pinyin, definition, tone, practicalExample, funnyExample}.CRITICAL:For practicalExample and funnyExample, use the format "Chinese Sentence | Pinyin | English Translation".`,
        config: { responseMimeType: "application/json" }
      });
      setActiveWord({ ...JSON.parse(res.text || "{}"), id: `lookup-${Date.now()}` });
    } catch (e) {} finally { setIsModalLoading(false); }
  };

  const handleSearch = async (q?: string) => {
    const target = q || searchQuery; if (!target.trim()) return;
    setSearchQuery(target); setIsSearching(true);
    try {
      const ai = createAI();
      const res = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Translate and explain: "${target}". JSON array: [{word, pinyin, definition, tone, practicalExample, funnyExample}]. CRITICAL: For each item, practicalExample and funnyExample MUST follow the format "Chinese Sentence | Pinyin | English Translation".`,
        config: { responseMimeType: "application/json" }
      });
      setSearchResults(JSON.parse(res.text || "[]").map((item: any, idx: number) => ({ ...item, id: `s-${idx}-${Date.now()}` })));
    } catch (e) {} finally { setIsSearching(false); }
  };

  const handleStartExam = async (level: number) => {
    setIsGeneratingQuestions(true);
    try {
      const ai = createAI();
      const res = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        // contents: `Generate 10 HSK level ${level} questions in JSON. CRITICAL: 
        // 1) For HSK 1 and 2, the 'question' and 'options' MUST include both Chinese Characters AND Pinyin (e.g., "你好 (nǐ hǎo)") to match real test standards. 
        // 2) The 'explanation' field MUST be in English and cover: (a) what the question asked, (b) why the correct answer is right, (c) common pitfalls.`,
        contents: `Generate 10 HSK level ${level} questions in JSON. 
        Follow official HSK exam formats:
        - For Level 1-2: Use "Dialogue Completion" (e.g., A: 你好！ B: ____) or "Gap Filling" (e.g., 我们都（ ）喜欢谢小姐。).
        - For Level 3+: Use "Reading Comprehension" or "Semantic Selection".
        
        CRITICAL RULES:
        1) The correct answer characters/pinyin MUST NOT appear in the question text. 
        2) For HSK 1 and 2, the 'question' and 'options' MUST include both Chinese Characters AND Pinyin.
        3) Use '____' to indicate blanks.
        4) The 'explanation' field MUST be in English.`,
        config: { 
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING }, level: { type: Type.NUMBER }, question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } }, answer: { type: Type.NUMBER },
                audioText: { type: Type.STRING }, explanation: { type: Type.STRING }
              }
            }
          }
        }
      });
      const q = JSON.parse(res.text || "[]");
      if (q.length > 0) { setCurrentExamQuestions(q); setCurrentQuestionIndex(0); setUserAnswers({}); setPracticeMode('exam'); }
    } catch (e) {} finally { setIsGeneratingQuestions(false); }
  };

  const handleAnswerQuestion = (idx: number) => {
    const question = currentExamQuestions[currentQuestionIndex];
    if (idx !== question.answer) setMistakes(prev => prev.some(m => m.id === question.id) ? prev : [...prev, { ...question, userAnswer: idx }]);
    setUserAnswers(prev => ({ ...prev, [currentQuestionIndex]: idx }));
    if (currentQuestionIndex < currentExamQuestions.length - 1) setCurrentQuestionIndex(i => i + 1);
    else setPracticeMode('review');
  };

  const slayedCount = useMemo(() => Object.entries(userAnswers).filter(([i, a]) => a === currentExamQuestions[parseInt(i)]?.answer).length, [userAnswers, currentExamQuestions]);

  if (isDataLoading) return <div className="h-[100dvh] flex items-center justify-center bg-white"><Loader2 className="animate-spin text-[#6495ED]" size={48} /></div>;

  return (
    <div className="h-[100dvh] flex flex-col max-w-md mx-auto relative overflow-hidden text-[#262626] bg-white shadow-2xl">
      {isGeneratingQuestions && (
        <div className="fixed inset-0 z-[100] bg-white/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
          <Sparkles className="text-[#6495ED] animate-pulse mb-6" size={64} />
          <h2 className="text-2xl font-black uppercase mb-2">Slay <span className="text-[#6495ED]">is Cooking</span></h2>
        </div>
      )}

      <main className="flex-1 overflow-hidden relative flex flex-col">
        {currentTab === 'feed' && (
          <div className="h-full flex flex-col bg-white animate-in fade-in pb-24 relative overflow-hidden">
            <header style={{ paddingTop: 'calc(1.5rem + var(--safe-area-inset-top))' }} className="px-6 sticky top-0 z-20 bg-white/80 backdrop-blur-md flex items-center justify-between">
              <div className="w-10">{(isSavedFeedView || currentSong || songListResults.length > 0) && <button onClick={() => { if (currentSong) setCurrentSong(null); else if (songListResults.length > 0) setSongListResults([]); else setIsSavedFeedView(false); }} className="p-2 -ml-2 text-gray-400 hover:text-[#6495ED]"><ChevronLeft size={24} /></button>}</div>
              <h1 className="flex-1 text-4xl font-black tracking-tighter uppercase text-center"><span className="text-[#6495ED]">SLAY</span> <span onClick={() => setIsSavedFeedView(!isSavedFeedView)} className="cursor-pointer">LYRICS</span></h1>
              <div className="w-10" />
            </header>
            <div className="flex-1 overflow-y-auto px-6 pb-8 hide-scrollbar flex flex-col">
              {isSavedFeedView ? (
                <div className="space-y-4 pt-4">
                  {savedSongs.length === 0 ? <div className="text-center py-20 text-gray-200 font-black text-xs uppercase tracking-widest">No saved lyrics.</div> : savedSongs.map(s => (
                    <div key={s.id} onClick={() => { setCurrentSong(s); setIsSavedFeedView(false); }} className="p-5 bg-white border-2 border-gray-50 rounded-[32px] hover:border-[#6495ED] transition-all cursor-pointer flex items-center justify-between shadow-sm active:scale-[0.98]">
                      <div><h3 className="font-black text-lg">{s.title}</h3><p className="text-xs font-bold text-gray-400">{s.artist}</p></div>
                      <ChevronRight size={20} className="text-gray-200" />
                    </div>
                  ))}
                </div>
              ) : (

                <div className="flex-1 flex flex-col pt-4 min-h-0">
                  {!currentSong && (
                    <div className="relative mb-4 p-1.5 border border-gray-100 rounded-[28px] shrink-0">
                      <input type="text" placeholder="SEARCH SONG OR ARTIST..." className="w-full bg-white rounded-[22px] py-4 px-6 text-xs font-black uppercase outline-none" value={songSearchQuery} onChange={e => setSongSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearchLyrics()} />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button onClick={handleSearchLyrics} disabled={isSearchingLyrics || isImageProcessing} className="text-[#6495ED] p-2">
                           {isSearchingLyrics ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} strokeWidth={4} />}
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} disabled={isSearchingLyrics || isImageProcessing} className="p-2 flex items-center justify-center">
                           {isImageProcessing ? <Loader2 size={18} className="animate-spin text-[#6495ED]" /> : <GoogleLensIcon size={22} color="#6495ED" />}
                        </button>
                      </div>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleVisualSearch} />
                    </div>
                  )}
                  {searchError && <div className="p-6 bg-red-50 rounded-[32px] text-center border border-red-100 mb-4"><p className="text-sm font-bold text-red-800">{searchError}</p></div>}
                  {currentSong ? (
                    <div className="animate-in slide-in-from-bottom-4 duration-500 flex-1 flex flex-col">
                      <div className="mb-8 flex justify-between items-start shrink-0">
                        <div className="flex-1 pr-4">
                          <h2 className="text-4xl font-black text-gray-900 leading-tight mb-1 tracking-tighter">{currentSong.title}</h2>
                          {currentSong.pinyin && <p className="text-[#6495ED] font-mono text-sm font-bold mb-0.5">{currentSong.pinyin}</p>}
                          {currentSong.englishTitle && <p className="text-gray-400 text-xs font-bold mb-1 italic">"{currentSong.englishTitle}"</p>}
                          <p className="text-[#6495ED] font-black uppercase tracking-[0.2em] text-[10px] opacity-60">{currentSong.artist}</p>
                        </div>
                        <button onClick={() => setSavedSongs(prev => prev.some(s => s.title === currentSong.title) ? prev.filter(s => s.title !== currentSong.title) : [...prev, currentSong])} className={`p-4 rounded-[24px] shadow-lg transition-all active:scale-90 ${savedSongs.some(s => s.title === currentSong.title) ? 'bg-[#6495ED] text-white' : 'bg-white text-gray-300 border border-gray-100'}`}>
                          <Heart size={24} fill={savedSongs.some(s => s.title === currentSong.title) ? "currentColor" : "none"} />
                        </button>
                      </div>
                      {currentSong.explanation && <div className="mb-8 bg-blue-50/50 p-6 rounded-[32px] border border-blue-100 shrink-0"><h4 className="text-[10px] font-black text-[#6495ED] uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><Sparkles size={12} /> Slay Vibe Check</h4><p className="text-sm font-bold italic leading-relaxed">{currentSong.explanation}</p></div>}
                      {currentSong.lyrics.length === 0 && isStreamingLyrics ? <div className="flex-1 flex flex-col items-center justify-center opacity-30 animate-pulse py-20"><Loader2 className="animate-spin mb-4 text-[#6495ED]" size={40} /><p className="text-[10px] font-black uppercase tracking-[0.3em]">Slay is retrieving lyrics...</p></div> : <div className="space-y-4 pb-32">{currentSong.lyrics.map((l, i) => (<div key={i} className="group cursor-pointer p-4 rounded-3xl hover:bg-blue-50/50 transition-colors" onClick={() => slaySpeak(l.line)}><h3 className="text-2xl font-black text-gray-900 group-hover:text-[#6495ED] mb-0.5 tracking-tight">{l.line}</h3><p className="text-[#6495ED] font-mono text-[10px] font-bold mb-1">{l.pinyin}</p><p className="text-gray-400 text-[10px] italic">"{l.translation}"</p></div>))}</div>}
                      {/* <div className="space-y-4 pb-32">{currentSong.lyrics.map((l, i) => (<div key={i} className="group cursor-pointer p-4 rounded-3xl hover:bg-blue-50/50" onClick={() => slaySpeak(l.line)}><h3 className="text-2xl font-black text-gray-900 group-hover:text-[#6495ED] mb-0.5 tracking-tight">{l.line}</h3><p className="text-[#6495ED] font-mono text-[10px] font-bold mb-1">{l.pinyin}</p><p className="text-gray-400 text-[10px] italic">"{l.translation}"</p></div>))}</div> */}
                    </div>
                  ) : songListResults.length > 0 ? (
                    <div className="space-y-4">
                      {songListResults.map((s, idx) => {
                        const loading = fetchingSongId === `${s.title}-${s.artist}`;
                        return (
                          <div key={idx} onClick={() => !fetchingSongId && fetchFullLyrics(s)} className={`p-6 bg-white border-2 rounded-[32px] flex justify-between items-center transition-all ${loading ? 'border-[#6495ED] bg-blue-50/20' : 'border-gray-50 hover:border-[#6495ED] cursor-pointer shadow-sm active:scale-[0.98]'}`}>
                            <div className="flex-1 pr-4 overflow-hidden">
                              <h3 className="font-black text-xl truncate mb-0.5">{s.title}</h3>
                              <p className="text-[#6495ED] font-mono text-[9px] font-bold truncate mb-0.5">{s.pinyin}</p>
                              {s.englishTitle && <p className="text-gray-400 text-[10px] font-bold truncate italic mb-1">"{s.englishTitle}"</p>}
                              <span className="text-[10px] font-black uppercase text-gray-300">{s.artist}</span>
                            </div>
                            {loading ? <Loader2 size={24} className="animate-spin text-[#6495ED]" /> : <ChevronRight size={24} className="text-gray-200" />}
                          </div>
                        );
                      })}
                    </div>
                  ) : !isSearchingLyrics && <div className="flex-1 flex flex-col items-center justify-center py-24 text-center"><Music size={120} className="text-blue-50 mb-6" /><div className="text-sm font-black uppercase tracking-widest text-gray-200"><TypingPlaceholder phrases={["Search Title or Artist...", "Look Up QILIN", "Try Jay Chou", "Or G.E.M."]} /></div></div>}
                </div>
              )}
            </div>
          </div>
        )}

        {currentTab === 'practice' && (
          <div className="h-full bg-white flex flex-col pb-24 relative">
            <header style={{ paddingTop: 'calc(1.5rem + var(--safe-area-inset-top))' }} className="px-6"><h1 className="text-4xl font-black uppercase tracking-tighter text-center"><span className="text-[#6495ED]">PRACTICE</span> TEST</h1></header>
            <div className="flex-1 overflow-y-auto px-8 pb-8 pt-4 hide-scrollbar">
              {practiceMode === 'selection' ? <div className="grid grid-cols-2 gap-4 mt-4">{[1,2,3,4,5,6].map(l => (<button key={l} onClick={() => handleStartExam(l)} className="p-6 rounded-[32px] border-2 border-gray-100 hover:border-[#6495ED] flex flex-col items-center gap-3 active:scale-95 shadow-sm"><GraduationCap size={32} className="text-[#6495ED]" /><span className="font-black">HSK {l}</span></button>))}</div> : practiceMode === 'exam' ? <div className="animate-in slide-in-from-right-4"><button onClick={() => setPracticeMode('selection')} className="flex items-center gap-1.5 text-[#6495ED] font-black text-[10px] uppercase mb-6"><ChevronLeft size={16} strokeWidth={3} />Back</button>{currentExamQuestions[currentQuestionIndex].audioText && <ListeningBar text={currentExamQuestions[currentQuestionIndex].audioText} />}<div className="space-y-6 mt-4"><h2 className="text-base font-black text-center leading-tight">{currentExamQuestions[currentQuestionIndex].question}</h2><div className="grid gap-3">{currentExamQuestions[currentQuestionIndex].options.map((o, idx) => (<button key={idx} onClick={() => handleAnswerQuestion(idx)} className="p-6 text-left rounded-3xl border-2 border-gray-100 font-bold hover:border-[#6495ED] active:scale-95 transition-all"><span className="inline-block w-8 text-[#6495ED] font-black">{String.fromCharCode(65 + idx)}.</span> {o}</button>))}</div></div></div> : <div className="space-y-6"><div className="bg-white border-4 border-[#6495ED] p-8 rounded-[40px] text-center shadow-lg flex flex-col items-center gap-1"><span className="text-[10px] font-black text-[#6495ED] uppercase tracking-[0.2em]">HSK LEVEL {currentExamQuestions[0]?.level}</span><h2 className="text-[#6495ED] font-black text-4xl uppercase tracking-tighter">Slayed {slayedCount} / {currentExamQuestions.length}</h2></div><button onClick={() => setPracticeMode('selection')} className="w-full bg-[#6495ED] text-white py-5 rounded-[24px] font-black shadow-xl active:scale-95">TRY AGAIN</button>{currentExamQuestions.map((q, i) => { const userIdx = userAnswers[i]; const ok = userIdx === q.answer; const exp = expandedMistakes.has(q.id); const isBookmarked = mistakes.some(m => m.id === q.id); return (<div key={i} onClick={() => q.audioText && slaySpeak(q.audioText)} className={`p-6 rounded-[32px] border-2 relative ${ok ? 'border-green-100 bg-green-50/10' : 'border-red-100 bg-red-50/10 shadow-sm'} ${q.audioText ? 'cursor-pointer' : ''}`}><div className="absolute top-5 right-5 flex gap-2"><button onClick={(e) => { e.stopPropagation(); setExpandedMistakes(prev => { const n = new Set(prev); if (n.has(q.id)) n.delete(q.id); else n.add(q.id); return n; }); }} className={`p-2 rounded-xl border transition-all ${exp ? 'bg-[#6495ED] text-white border-[#6495ED]' : 'bg-white text-gray-300 border-gray-100 hover:border-[#6495ED] hover:text-[#6495ED]'}`}><Lightbulb size={16} /></button><button onClick={(e) => { e.stopPropagation(); if (isBookmarked) { setMistakes(prev => prev.filter(m => m.id !== q.id)); } else { setMistakes(prev => [...prev, q]); } }} className={`p-2 rounded-xl border transition-all ${isBookmarked ? 'bg-[#6495ED] text-white border-[#6495ED]' : 'bg-white text-gray-300 border-gray-100 hover:border-[#6495ED] hover:text-[#6495ED]'}`}><Bookmark size={16} fill={isBookmarked ? "currentColor" : "none"} /></button></div><p className="font-black text-lg mb-3 pr-24 leading-snug">{q.question}</p><div className="space-y-1 text-sm font-bold"><p className={ok ? 'text-green-600' : 'text-red-500'}>Your Answer: <span className="font-black">{q.options[userIdx ?? -1] || 'None'}</span></p><p className="text-green-600">Correct: <span className="font-black">{q.options[q.answer]}</span></p></div>{exp && q.explanation && <div className="mt-4 p-4 bg-white rounded-2xl border border-blue-50 text-sm font-bold italic text-gray-600 leading-relaxed animate-in fade-in slide-in-from-top-2">{q.explanation}</div>}</div>);})}</div>}
            </div>
          </div>
        )}

        {currentTab === 'search' && (
          <div className="h-full flex flex-col bg-white pb-24">
            <header style={{ paddingTop: 'calc(1.5rem + var(--safe-area-inset-top))' }} className="px-6"><h1 className="text-4xl font-black uppercase tracking-tighter text-center"><span className="text-[#6495ED]">SLAY</span> MANDARIN</h1></header>
            <div className="pt-4 px-6 flex-1 flex flex-col min-h-0"><div className="relative mb-0 p-1.5 border border-gray-100 rounded-[28px]"><input type="text" placeholder="SEARCH WORD OR PHRASE..." className="w-full bg-white rounded-[22px] py-4 px-6 text-xs font-black uppercase outline-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} /><button onClick={() => handleSearch()} disabled={isSearching} className="absolute right-5 top-1/2 -translate-y-1/2 text-[#6495ED] p-2">{isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} strokeWidth={4} />}</button></div><div className="flex-1 overflow-y-auto space-y-4 px-2 hide-scrollbar flex flex-col">{searchResults.length > 0 ? (searchResults.map(e => (<div key={e.id} onClick={() => setActiveWord(e)} className="p-7 bg-white rounded-[32px] border-2 border-gray-50 hover:border-[#6495ED] flex justify-between items-center group cursor-pointer shadow-sm"><div className="flex-1"><h3 className="text-3xl font-black group-hover:text-[#6495ED]">{e.word}</h3><p className="text-sm text-gray-500">{e.definition}</p></div><ChevronRight size={20} className="text-gray-300" /></div>))) : !isSearching && <div className="flex-1 flex flex-col items-center justify-center py-24 text-center"><Zap size={120} className="text-blue-50 mb-6" /><div className="text-sm font-black uppercase tracking-widest text-gray-200"><TypingPlaceholder phrases={["Search slang...", "Translate idioms...", "Slay vocabulary..."]} /></div></div>}</div></div>
          </div>
        )}

{currentTab === 'notebook' && (
          <div className="h-full bg-white flex flex-col pb-24">
            <header style={{ paddingTop: 'calc(1.5rem + var(--safe-area-inset-top))' }} className="px-6"><h1 className="text-4xl font-black uppercase tracking-tighter text-center">MY <span className="text-[#6495ED]">COLLECTION</span></h1></header>
            <div className="pt-4 px-6 flex-1 flex flex-col min-h-0">
              <div className="flex flex-col gap-4 mb-8 shrink-0">
                <div className="flex gap-4 p-1.5 border border-gray-100 rounded-[28px]">
                  <button onClick={() => {setNotebookView('vocabulary'); setIsFlashcardMode(false);}} className={`flex-1 py-4 rounded-[22px] text-xs font-black uppercase ${notebookView === 'vocabulary' ? 'bg-blue-50 text-[#6495ED]' : 'text-gray-300'}`}>Vocab</button>
                  <button onClick={() => {setNotebookView('questions'); setIsFlashcardMode(false);}} className={`flex-1 py-4 rounded-[22px] text-xs font-black uppercase ${notebookView === 'questions' ? 'bg-blue-50 text-[#6495ED]' : 'text-gray-300'}`}>Questions</button>
                </div>
                {(notebookView === 'vocabulary' ? savedWords.length > 0 : mistakes.length > 0) && (
                  <button onClick={() => { setIsFlashcardMode(!isFlashcardMode); setFlashcardExplanationVisible(false); setFlashcardIndex(0); setIsFlashcardAudioPlaying(false); }} className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 ${isFlashcardMode ? 'bg-[#6495ED] text-white' : 'border-2 border-[#6495ED] text-[#6495ED]'}`}><Layers size={14} />{isFlashcardMode ? 'Back to List' : 'Flashcards'}</button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col">
                {isFlashcardMode ? (
                  <div className="flex-1 flex flex-col">
                    {notebookView === 'vocabulary' ? (
                      <div className="flex-1 flex flex-col gap-6">
                        <div className="flex-1 relative">
                          {/* Bottom Card for Stacking Effect - Dynamically chosen based on drag direction */}
                          {(( (exitDirection === 'left' || dragOffset < 0) && flashcardIndex + 1 < savedWords.length) || ((exitDirection === 'right' || dragOffset > 0) && flashcardIndex > 0)) && (
                            <div 
                              className="absolute inset-0 bg-white border-4 border-gray-50 rounded-[48px] p-8 flex flex-col items-center justify-center text-center shadow-sm"
                              style={{
                                transform: `scale(${0.9 + (Math.min(Math.abs(exitDirection ? 200 : dragOffset), 200) / 200) * 0.1}) translateY(${15 - (Math.min(Math.abs(exitDirection ? 200 : dragOffset), 200) / 200) * 15}px)`,
                                opacity: 0.3 + (Math.min(Math.abs(exitDirection ? 200 : dragOffset), 200) / 200) * 0.7,
                                zIndex: 0
                              }}
                            >
                              {(exitDirection === 'left' || (dragOffset < 0 && !exitDirection)) ? (
                                <>
                                  <h4 className="font-black text-5xl mb-4 text-gray-200">{savedWords[flashcardIndex + 1].word}</h4>
                                  <p className="text-xl text-gray-100 font-bold font-mono mb-4">{savedWords[flashcardIndex + 1].pinyin}</p>
                                  <p className="text-lg text-gray-100 font-medium mb-10">{savedWords[flashcardIndex + 1].definition}</p>
                                </>
                              ) : (
                                <>
                                  <h4 className="font-black text-5xl mb-4 text-gray-200">{savedWords[flashcardIndex - 1].word}</h4>
                                  <p className="text-xl text-gray-100 font-bold font-mono mb-4">{savedWords[flashcardIndex - 1].pinyin}</p>
                                  <p className="text-lg text-gray-100 font-medium mb-10">{savedWords[flashcardIndex - 1].definition}</p>
                                </>
                              )}
                            </div>
                          )}
                          
                          {/* Top Card */}
                          <div 
                            key={flashcardIndex}
                            className="absolute inset-0 bg-white border-4 border-gray-50 rounded-[48px] p-8 flex flex-col items-center justify-center text-center relative overflow-y-auto active:scale-[0.99] transition-all touch-pan-y shadow-md"
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={(e) => handleTouchEnd(e, savedWords.length - 1)}
                            style={{
                              transform: exitDirection === 'right' ? 'translateX(150%) rotate(30deg)' : 
                                         exitDirection === 'left' ? 'translateX(-150%) rotate(-30deg)' : 
                                         `translateX(${dragOffset}px) rotate(${dragOffset / 15}deg)`,
                              opacity: exitDirection ? 0 : (1 - Math.abs(dragOffset) / 500),
                              transition: dragOffset === 0 || exitDirection ? 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s' : 'none',
                              zIndex: 10
                            }}
                          >
                            <h4 onClick={() => slaySpeak(savedWords[flashcardIndex].word)} className="font-black text-5xl mb-4 cursor-pointer">{savedWords[flashcardIndex].word}</h4>
                            <p className="text-xl text-[#6495ED] font-bold font-mono mb-4">{savedWords[flashcardIndex].pinyin}</p>
                            <p className="text-lg text-gray-500 font-medium mb-10">{savedWords[flashcardIndex].definition}</p>
                            <div className="absolute bottom-6 text-gray-200 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Swipe to switch</div>
                          </div>
                        </div>
                        <div className="flex justify-between items-center px-4 py-4 bg-gray-50 rounded-3xl shrink-0">
                          <button disabled={flashcardIndex===0} onClick={()=>setFlashcardIndex(i=>i-1)} className="p-4 disabled:opacity-20"><ChevronLeft/></button>
                          <span className="text-[10px] font-black uppercase text-gray-400">{flashcardIndex+1}/{savedWords.length}</span>
                          <button disabled={flashcardIndex===savedWords.length-1} onClick={()=>setFlashcardIndex(i=>i+1)} className="p-4 disabled:opacity-20"><ChevronRight/></button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col gap-6">
                        <div className="flex-1 relative">
                          {/* Bottom Card for Stacking Effect - Questions */}
                          {(( (exitDirection === 'left' || dragOffset < 0) && flashcardIndex + 1 < mistakes.length) || ((exitDirection === 'right' || dragOffset > 0) && flashcardIndex > 0)) && (
                            <div 
                              className="absolute inset-0 bg-white border-4 border-gray-50 rounded-[40px] p-8 flex flex-col overflow-hidden shadow-sm"
                              style={{
                                transform: `scale(${0.9 + (Math.min(Math.abs(exitDirection ? 200 : dragOffset), 200) / 200) * 0.1}) translateY(${15 - (Math.min(Math.abs(exitDirection ? 200 : dragOffset), 200) / 200) * 15}px)`,
                                opacity: 0.3 + (Math.min(Math.abs(exitDirection ? 200 : dragOffset), 200) / 200) * 0.7,
                                zIndex: 0
                              }}
                            >
                              {(exitDirection === 'left' || (dragOffset < 0 && !exitDirection)) ? (
                                <>
                                  <div className="flex justify-between items-center mb-6 w-full shrink-0">
                                    <span className="bg-gray-50 text-gray-100 px-5 h-[52px] rounded-2xl text-[11px] font-black flex items-center">HSK {mistakes[flashcardIndex + 1].level}</span>
                                  </div>
                                  <h4 className="font-black text-2xl mb-8 text-gray-100 leading-tight w-full text-left">{mistakes[flashcardIndex + 1].question}</h4>
                                </>
                              ) : (
                                <>
                                  <div className="flex justify-between items-center mb-6 w-full shrink-0">
                                    <span className="bg-gray-50 text-gray-100 px-5 h-[52px] rounded-2xl text-[11px] font-black flex items-center">HSK {mistakes[flashcardIndex - 1].level}</span>
                                  </div>
                                  <h4 className="font-black text-2xl mb-8 text-gray-100 leading-tight w-full text-left">{mistakes[flashcardIndex - 1].question}</h4>
                                </>
                              )}
                            </div>
                          )}

                          {/* Top Card */}
                          <div 
                            key={flashcardIndex}
                            className="absolute inset-0 bg-white border-4 border-gray-50 rounded-[40px] p-8 flex flex-col overflow-y-auto relative active:scale-[0.99] transition-all touch-pan-y shadow-md"
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={(e) => handleTouchEnd(e, mistakes.length - 1)}
                            style={{
                              transform: exitDirection === 'right' ? 'translateX(150%) rotate(30deg)' : 
                                         exitDirection === 'left' ? 'translateX(-150%) rotate(-30deg)' : 
                                         `translateX(${dragOffset}px) rotate(${dragOffset / 15}deg)`,
                              opacity: exitDirection ? 0 : (1 - Math.abs(dragOffset) / 500),
                              transition: dragOffset === 0 || exitDirection ? 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s' : 'none',
                              zIndex: 10
                            }}
                          >
                            
<div className="flex justify-between items-center mb-6 w-full shrink-0">
<span className="bg-blue-50 text-[#6495ED] px-5 h-[52px] rounded-2xl text-[11px] font-black flex items-center">HSK {mistakes[flashcardIndex].level}</span>
                               <div className="flex gap-2">                              
                                {mistakes[flashcardIndex].audioText && (
                                <button onClick={(e) => { e.stopPropagation(); slaySpeak(mistakes[flashcardIndex].audioText!); }} className="p-3 rounded-2xl bg-blue-50 text-[#6495ED] hover:bg-blue-100 transition-all active:scale-90">
                                  <Volume2 size={24} />
                                </button>
                              )}
                              <button onClick={() => setFlashcardExplanationVisible(!flashcardExplanationVisible)} className={`p-3 rounded-2xl ${flashcardExplanationVisible ? 'bg-[#6495ED] text-white' : 'bg-gray-50 text-gray-300'}`}>
                                <Lightbulb size={24} />
                              </button>
                            </div>
                            </div>
                            <h4 className="font-black text-2xl mb-8 leading-tight w-full text-left">{mistakes[flashcardIndex].question}</h4>
                            <div className="space-y-3 mb-6 w-full">                           
                              {mistakes[flashcardIndex].options.map((o, idx) => {
                                const isCorrect = idx === mistakes[flashcardIndex].answer;
                                const isUserChoice = idx === mistakes[flashcardIndex].userAnswer;
                                let style = 'border-gray-50';
                                if (isCorrect) style = 'border-green-100 bg-green-50 text-green-700';
                                else if (isUserChoice) style = 'border-red-100 bg-red-50 text-red-700';
                                return (<div key={idx} className={`p-5 rounded-2xl border-2 font-bold ${style}`}>{o}</div>);
                              })}
                            </div>
                            {flashcardExplanationVisible && mistakes[flashcardIndex].explanation && (<div className="w-full mt-4 p-5 bg-blue-50/50 rounded-3xl border border-blue-100 animate-in fade-in slide-in-from-top-2 duration-300"><h5 className="text-[10px] font-black uppercase text-[#6495ED] mb-2">Explanation</h5><p className="text-sm font-bold italic text-gray-700 leading-relaxed">{mistakes[flashcardIndex].explanation}</p></div>)}
                          </div>
                        </div>
                        <div className="flex justify-between items-center px-4 py-4 bg-gray-50 rounded-3xl shrink-0">
                          <button disabled={flashcardIndex===0} onClick={()=>setFlashcardIndex(i=>i-1)} className="p-4 disabled:opacity-20"><ChevronLeft/></button>
                          <span className="text-[10px] font-black uppercase text-gray-400">{flashcardIndex+1}/{mistakes.length}</span>
                          <button disabled={flashcardIndex===mistakes.length-1} onClick={()=>setFlashcardIndex(i=>i+1)} className="p-4 disabled:opacity-20"><ChevronRight/></button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col space-y-4">
                    {notebookView === 'vocabulary' ? (
                      savedWords.length === 0 ? <div className="text-center py-20 text-gray-200 font-black text-xs uppercase tracking-widest">No saved words</div> : savedWords.map(w => (
                        <div key={w.word} className="p-6 bg-white rounded-[32px] border-2 border-gray-50 flex justify-between items-center shadow-sm">
                          <div onClick={() => setActiveWord(w)} className="cursor-pointer flex-1">
                            <h4 className="font-black text-2xl">{w.word}</h4>
                            <p className="text-xs font-bold text-[#6495ED]">{w.pinyin}</p>
                            <p className="text-[10px] text-gray-400 font-medium line-clamp-1 mt-0.5">{w.definition}</p>
                          </div>
                          <button onClick={() => setSavedWords(prev => prev.filter(v => v.word !== w.word))} className="p-3 text-gray-200 hover:text-red-400"><Trash2 size={22} /></button>
                        </div>
                      ))
                    ) : (
                      mistakes.length === 0 ? <div className="text-center py-20 text-gray-200 font-black text-xs uppercase tracking-widest">No saved questions</div> : mistakes.map(m => (
                        <div key={m.id} onClick={() => m.audioText && slaySpeak(m.audioText)} className={`p-6 bg-white rounded-[32px] border-2 border-gray-50 flex flex-col shadow-sm active:scale-[0.98] ${m.audioText ? 'cursor-pointer' : ''}`}>
                          <div className="flex justify-between items-start gap-3">
                            <div className="flex-1">
                              <span className="text-[9px] font-black uppercase text-[#6495ED] bg-blue-50 px-2 py-0.5 rounded-md mb-1 inline-block">HSK {m.level}</span>
                              <h4 className="font-black text-lg leading-tight mb-3">{m.question}</h4>
                              <div className="space-y-1 text-[11px] font-bold mb-3">
                                <p className={m.userAnswer === m.answer ? 'text-green-600' : 'text-red-500'}>Your Choice: <span className="font-black">{m.options[m.userAnswer ?? -1] || 'None'}</span></p>
                                <p className="text-green-600">Correct: <span className="font-black">{m.options[m.answer]}</span></p>
                              </div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setMistakes(prev => prev.filter(q => q.id !== m.id)); }} className="p-3 text-gray-200 hover:text-red-400 shrink-0"><Trash2 size={24} /></button>
                          </div>
                          {m.explanation && <div className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 text-[10px] font-bold italic text-gray-600 leading-relaxed mt-2"><h5 className="text-[8px] font-black uppercase text-[#6495ED] mb-1">Explanation</h5>{m.explanation}</div>}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {currentTab === 'slay' && (
          <div className="h-full flex flex-col bg-white pb-24 relative overflow-hidden">
            <header style={{ paddingTop: 'calc(1.5rem + var(--safe-area-inset-top))' }} className="px-6 text-center shrink-0">
              <h1 className="text-4xl font-black uppercase tracking-tighter"><span className="text-[#6495ED]">SLAY</span> LIVE</h1>
              <p className="text-[10px] font-black uppercase text-gray-300 tracking-[0.3em] mt-1">practice speaking now</p>
            </header>
            <div className="flex-1 flex flex-col items-center justify-center text-center relative"><div onClick={!isVoiceActive ? startVoiceSession : undefined} className="w-56 h-56 relative flex items-center justify-center cursor-pointer transition-all hover:scale-105 mb-6">
            <div className={`absolute inset-0 rounded-full border-4 flex items-center justify-center bg-white transition-all duration-500 ${isVoiceActive ? 'border-[#6495ED] shadow-[0_0_60px_rgba(100,149,237,0.4)] animate-pulse' : 'border-gray-50 shadow-[0_0_40px_rgba(100,149,237,0.1)]'}`}><Apple size={80} className={`transition-colors duration-300 ${isVoiceActive ? 'text-[#6495ED]' : 'text-gray-100'}`}/></div></div><p className="text-[10px] font-black uppercase tracking-widest text-gray-300">{isVoiceActive ? 'Slay is active' : 'Tap to start'}</p>{isVoiceActive && <button onClick={stopVoiceSession} className="absolute bottom-12 py-4 px-10 rounded-[24px] bg-[#6495ED] text-white font-black uppercase shadow-xl active:scale-95 flex items-center gap-3"><PhoneOff size={18} />Hang Up</button>}</div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-50 flex items-center justify-around z-50 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
        {[
          { id: 'feed', icon: ListMusic, size: 28 },
          { id: 'practice', icon: GraduationCap, size: 32 },
          { id: 'search', icon: Search, size: 28, center: true },
          { id: 'notebook', icon: BookMarked, size: 28 },
          { id: 'slay', icon: Apple, size: 28 },
        ].map(i => (
          i.center ? (
            <button key={i.id} onClick={() => setCurrentTab(i.id)} className={`w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-2xl ${currentTab === i.id ? 'bg-[#6495ED] text-white' : 'bg-white text-[#6495ED] border-2 border-gray-50'}`}><i.icon size={i.size} strokeWidth={4} /></button>
          ) : (
            <button key={i.id} onClick={() => setCurrentTab(i.id)} className={`p-3 transition-all ${currentTab === i.id ? 'text-[#6495ED]' : 'text-gray-200'}`}><i.icon size={i.size} fill={currentTab === i.id ? 'currentColor' : 'none'} strokeWidth={2.5} /></button>
          )
        ))}
      </nav>

      <DictionaryModal entry={activeWord} isLoading={isModalLoading} isSaved={!!activeWord && savedWords.some(w => w.word === activeWord.word)} onClose={() => setActiveWord(null)} onSave={e => setSavedWords(prev => [...prev, e])} />
    </div>
  );
}
