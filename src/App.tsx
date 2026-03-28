import React, { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Sparkles, Target, Award, ListChecks, ArrowRight, Download, Lightbulb, Moon, Sun, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { auth, db, googleProvider } from './lib/firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, addDoc, query, where, orderBy, onSnapshot, deleteDoc, doc, Timestamp, getDocFromServer } from 'firebase/firestore';
import { cn } from './lib/utils';
import { extractTextFromPDF } from './lib/pdfUtils';
import { analyzeResume } from './services/geminiService';
import { ResumeAnalysis, AnalysisState, AnalysisRecord } from './types';
import History from './components/History';
import ProfilePictureGenerator from './components/ProfilePictureGenerator';

const GENERAL_TIPS = [
  {
    title: "Use Action Verbs",
    description: "Start your bullet points with strong action verbs like 'Developed', 'Managed', or 'Optimized' to show initiative."
  },
  {
    title: "Quantify Achievements",
    description: "Use numbers and percentages (e.g., 'Increased sales by 20%') to provide concrete evidence of your impact."
  },
  {
    title: "Keep it Concise",
    description: "Aim for 1-2 pages. Recruiters often spend only a few seconds on the first pass, so make every word count."
  },
  {
    title: "Tailor for the Role",
    description: "Customize your resume for each application by highlighting the skills and experiences most relevant to the job description."
  },
  {
    title: "Professional Formatting",
    description: "Use a clean, readable font and consistent spacing. Avoid overly complex layouts that might confuse ATS systems."
  },
  {
    title: "Proofread Thoroughly",
    description: "Typos and grammatical errors can be a dealbreaker. Check your resume multiple times or use a professional tool."
  }
];

export default function App() {
  const [user] = useAuthState(auth);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [restoredFileName, setRestoredFileName] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisState>({
    isLoading: false,
    error: null,
    result: null,
  });
  const [history, setHistory] = useState<AnalysisRecord[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);

  // Test connection to Firestore
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Fetch history from Firestore
  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }

    const q = query(
      collection(db, 'analyses'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AnalysisRecord[];
      setHistory(records);
    }, (error) => {
      console.error('Firestore Error: ', error);
    });

    return () => unsubscribe();
  }, [user]);

  // Initialize theme and restore analysis from local storage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }

    const savedAnalysis = localStorage.getItem('resume_analysis');
    const savedFileName = localStorage.getItem('resume_filename');
    if (savedAnalysis) {
      try {
        const parsed = JSON.parse(savedAnalysis);
        setAnalysis(prev => ({ ...prev, result: parsed }));
        if (savedFileName) setRestoredFileName(savedFileName);
      } catch (e) {
        console.error('Failed to restore analysis:', e);
      }
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Autosave analysis result
  useEffect(() => {
    if (analysis.result) {
      localStorage.setItem('resume_analysis', JSON.stringify(analysis.result));
    } else if (!analysis.isLoading) {
      localStorage.removeItem('resume_analysis');
    }
  }, [analysis.result, analysis.isLoading]);

  useEffect(() => {
    if (file) {
      localStorage.setItem('resume_filename', file.name);
      setRestoredFileName(null);
    } else if (!restoredFileName) {
      localStorage.removeItem('resume_filename');
    }
  }, [file, restoredFileName]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.type !== 'application/pdf' && !selectedFile.type.startsWith('text/')) {
      setAnalysis(prev => ({ ...prev, error: 'Please upload a PDF or text file.' }));
      return;
    }

    setFile(selectedFile);
    setAnalysis({ isLoading: true, error: null, result: null });

    try {
      let text = '';
      let fileData: { data: string; mimeType: string } | undefined;

      if (selectedFile.type === 'application/pdf') {
        try {
          text = await extractTextFromPDF(selectedFile);
        } catch (err) {
          console.warn('PDF text extraction failed, falling back to direct file analysis:', err);
        }
      } else {
        text = await selectedFile.text();
      }

      // If text extraction failed or returned empty, and it's a PDF, send the file directly
      if (!text.trim() && selectedFile.type === 'application/pdf') {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(selectedFile);
        const base64 = await base64Promise;
        fileData = { data: base64, mimeType: selectedFile.type };
      }

      if (!text.trim() && !fileData) {
        throw new Error('Could not extract text from the file. It might be empty or scanned.');
      }

      const result = await analyzeResume(fileData ? { fileData } : { text });
      
      // Save to Firestore if user is logged in
      if (user) {
        try {
          await addDoc(collection(db, 'analyses'), {
            userId: user.uid,
            fileName: selectedFile.name,
            ...result,
            createdAt: Timestamp.now(),
          });
        } catch (err) {
          console.error('Failed to save analysis to history:', err);
        }
      }

      setAnalysis({ isLoading: false, error: null, result });
    } catch (err: any) {
      console.error(err);
      setAnalysis({
        isLoading: false,
        error: err.message || 'An error occurred during analysis.',
        result: null,
      });
    }
  };

  const downloadResults = () => {
    if (!analysis.result) return;

    const doc = new jsPDF();
    const margin = 20;
    let y = margin;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(234, 88, 12); // orange-600
    doc.text('RESUME ANALYSIS REPORT', margin, y);
    y += 15;

    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated by ResumeAIAnalyzer on ${new Date().toLocaleDateString()}`, margin, y);
    y += 20;

    // Main Info
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(`Predicted Role: ${analysis.result.predictedRole}`, margin, y);
    y += 10;
    doc.text(`Resume Score: ${analysis.result.resumeScore}/100`, margin, y);
    y += 20;

    // Summary
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('SUMMARY', margin, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const summaryLines = doc.splitTextToSize(analysis.result.summary, 170);
    doc.text(summaryLines, margin, y);
    y += (summaryLines.length * 6) + 15;

    // Job Recommendations
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('CAREER PATHS & SKILL GAPS', margin, y);
    y += 10;
    doc.setFontSize(11);
    analysis.result.recommendations.forEach(rec => {
      if (y > 260) { doc.addPage(); y = margin; }
      doc.setFont('helvetica', 'bold');
      doc.text(`${rec.role} (${rec.matchPercentage}% Match)`, margin, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      const skillsText = `Missing Skills: ${rec.missingSkills.join(', ')}`;
      const skillsLines = doc.splitTextToSize(skillsText, 160);
      doc.text(skillsLines, margin + 5, y);
      y += (skillsLines.length * 6) + 6;
    });

    y += 10;

    // Suggested Improvements
    if (y > 260) { doc.addPage(); y = margin; }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ACTIONABLE IMPROVEMENTS', margin, y);
    y += 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    analysis.result.improvements.forEach((imp, i) => {
      if (y > 270) { doc.addPage(); y = margin; }
      const impLines = doc.splitTextToSize(`${i + 1}. ${imp}`, 170);
      doc.text(impLines, margin, y);
      y += (impLines.length * 6) + 4;
    });

    doc.save(`Resume_Analysis_${analysis.result.predictedRole.replace(/\s+/g, '_')}.pdf`);
  };

  const reset = () => {
    setFile(null);
    setRestoredFileName(null);
    setAnalysis({ isLoading: false, error: null, result: null });
    setLoginError(null);
    localStorage.removeItem('resume_analysis');
    localStorage.removeItem('resume_filename');
  };

  const login = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setLoginError(null);
    
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.code === 'auth/popup-blocked') {
        setLoginError("Popup blocked. Please allow popups for this site to log in.");
      } else if (error.code === 'auth/popup-closed-by-user') {
        setLoginError("Login window was closed before completion.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        setLoginError("Login request was cancelled.");
      } else {
        setLoginError("An error occurred during login. Please try again.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = () => {
    setLoginError(null);
    signOut(auth);
  };

  const selectFromHistory = (record: AnalysisRecord) => {
    setAnalysis({ isLoading: false, error: null, result: record });
    setRestoredFileName(record.fileName || 'Past Analysis');
    setIsHistoryOpen(false);
  };

  const deleteFromHistory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'analyses', id));
    } catch (err) {
      console.error('Failed to delete analysis:', err);
    }
  };

  const ScoreGauge = ({ score }: { score: number }) => {
    const circumference = 2 * Math.PI * 40;
    const offset = circumference - (score / 100) * circumference;

    return (
      <div className="relative flex items-center justify-center w-32 h-32">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-gray-100 dark:text-gray-800"
          />
          <motion.circle
            cx="64"
            cy="64"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="text-orange-600"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-gray-900 dark:text-white">{score}</span>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Score</span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] dark:bg-[#0A0A0A] text-[#1A1A1A] dark:text-gray-100 font-sans selection:bg-orange-100 dark:selection:bg-orange-500/30 transition-colors duration-500">
      {/* Header */}
      <nav className="border-b border-black/5 dark:border-white/10 px-6 py-4 flex justify-between items-center sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-xl z-50">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
            <Sparkles size={20} />
          </div>
          <span className="font-bold tracking-tight text-xl dark:text-white">ResumeAIAnalyzer</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex gap-8 text-sm font-semibold text-black/50 dark:text-white/50">
            <button 
              onClick={() => setIsGeneratorOpen(true)}
              className="hover:text-black dark:hover:text-white transition-colors flex items-center gap-1.5"
            >
              <Camera size={14} className="text-orange-600" />
              AI Photo
            </button>
            {user && (
              <button 
                onClick={() => setIsHistoryOpen(true)}
                className="hover:text-black dark:hover:text-white transition-colors"
              >
                History
              </button>
            )}
          </div>
          
          {user ? (
            <div className="flex items-center gap-3">
              <img 
                src={user.photoURL || ''} 
                alt={user.displayName || ''} 
                className="w-8 h-8 rounded-full border border-black/10 dark:border-white/10"
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={logout}
                className="text-sm font-bold text-gray-500 hover:text-black dark:hover:text-white transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <button 
                onClick={login}
                disabled={isLoggingIn}
                className={cn(
                  "px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-bold hover:scale-105 transition-transform flex items-center gap-2",
                  isLoggingIn && "opacity-50 cursor-not-allowed"
                )}
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Logging in...
                  </>
                ) : (
                  'Login'
                )}
              </button>
              <AnimatePresence>
                {loginError && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-[10px] font-bold text-red-500 absolute top-full mt-1 whitespace-nowrap"
                  >
                    {loginError}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          )}

          <button
            onClick={toggleTheme}
            className="group relative p-1 w-14 h-8 rounded-full bg-gray-200 dark:bg-white/10 transition-all duration-300 flex items-center"
            aria-label="Toggle theme"
          >
            <motion.div 
              layout
              transition={{ type: "spring", stiffness: 700, damping: 30 }}
              className={cn(
                "absolute w-6 h-6 rounded-full bg-white dark:bg-orange-500 shadow-sm flex items-center justify-center overflow-hidden",
                theme === 'light' ? "left-1" : "left-7"
              )}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={theme}
                  initial={{ y: -20, opacity: 0, rotate: -90 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  exit={{ y: 20, opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center justify-center"
                >
                  {theme === 'light' ? <Sun size={14} className="text-orange-500" /> : <Moon size={14} className="text-white" />}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12 md:py-20">
        <AnimatePresence mode="sync">
          {!analysis.result && !analysis.isLoading ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-12"
            >
              <div className="space-y-4">
                <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.1] dark:text-white">
                  Your resume, <br />
                  <span className="text-orange-600">supercharged by AI.</span>
                </h1>
                <p className="text-xl text-gray-700 dark:text-gray-400 max-w-2xl mx-auto font-medium">
                  Upload your resume to extract skills, predict your best job role, and get actionable improvements in seconds.
                </p>
              </div>

              <div className="max-w-xl mx-auto">
                <label className="group relative block cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.txt"
                    onChange={handleFileUpload}
                  />
                  <div className="border-2 border-dashed border-black/20 dark:border-white/20 rounded-3xl p-12 transition-all group-hover:border-orange-500 group-hover:bg-orange-50/50 dark:group-hover:bg-orange-900/10">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload size={32} />
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-lg dark:text-white">Click to upload or drag and drop</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">PDF or Text files (max 5MB)</p>
                      </div>
                    </div>
                  </div>
                </label>
              </div>

              {analysis.error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center gap-2 text-red-600 font-bold"
                >
                  <AlertCircle size={18} />
                  <span>{analysis.error}</span>
                </motion.div>
              )}
            </motion.div>
          ) : analysis.isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 space-y-6"
            >
              <div className="relative">
                <Loader2 className="w-12 h-12 text-orange-600 animate-spin" />
                <div className="absolute inset-0 blur-xl bg-orange-500/20 animate-pulse" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Analyzing your profile...</h2>
                <p className="text-gray-600 font-medium">Extracting skills and calculating your score</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {/* Results Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-black/10 dark:border-white/10 pb-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-orange-600 font-bold uppercase tracking-widest text-xs">
                    <Target size={14} />
                    Analysis Complete
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center gap-8">
                    <ScoreGauge score={analysis.result?.resumeScore || 0} />
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h2 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
                          {analysis.result?.predictedRole}
                        </h2>
                        {(file || restoredFileName) && (
                          <span className="px-3 py-1 bg-gray-100 dark:bg-white/10 rounded-full text-[10px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <FileText size={10} />
                            {file?.name || restoredFileName}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 dark:text-gray-400 max-w-xl font-medium leading-relaxed">
                        {analysis.result?.summary}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={downloadResults}
                    className="px-6 py-3 bg-white dark:bg-gray-900 border border-black/20 dark:border-white/20 text-black dark:text-white rounded-2xl font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <Download size={18} /> Save Report
                  </button>
                  <button
                    onClick={reset}
                    className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold hover:bg-gray-900 dark:hover:bg-gray-100 transition-colors flex items-center gap-2 shadow-lg"
                  >
                    Analyze Another <ArrowRight size={18} />
                  </button>
                </div>
              </div>

              {/* Grid Content - Dashboard Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Column: Job Recommendations */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="flex items-center gap-2 font-bold text-sm uppercase tracking-widest text-gray-500 dark:text-gray-400">
                    <Award size={16} />
                    Career Paths & Skill Gaps
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {analysis.result?.recommendations.map((rec, i) => (
                      <div key={i} className="bg-white dark:bg-white/5 p-6 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start mb-4">
                          <h4 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-orange-600 transition-colors">{rec.role}</h4>
                          <div className="px-3 py-1 bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 rounded-full text-xs font-bold">
                            {rec.matchPercentage}% Match
                          </div>
                        </div>
                        <div className="space-y-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Missing Skills to Master</p>
                          <div className="flex flex-wrap gap-2">
                            {rec.missingSkills.map((skill, j) => (
                              <span key={j} className="px-3 py-1.5 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl text-[11px] font-bold border border-black/5 dark:border-white/5">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Column: Suggested Improvements */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="flex items-center gap-2 font-bold text-sm uppercase tracking-widest text-gray-500 dark:text-gray-400">
                    <CheckCircle2 size={16} />
                    Actionable Improvements
                  </div>
                  <div className="bg-white dark:bg-white/5 p-6 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
                    {analysis.result?.improvements.map((improvement, i) => (
                      <div key={i} className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 flex gap-4 items-start hover:translate-x-1 transition-transform">
                        <div className="w-8 h-8 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm text-orange-600 font-bold shrink-0 border border-black/5 dark:border-white/5">
                          {i + 1}
                        </div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-relaxed">
                          {improvement}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Section: General Resume Tips */}
                <div className="lg:col-span-12 space-y-8 bg-orange-50/50 dark:bg-orange-500/5 p-8 md:p-12 rounded-[3rem] border border-orange-100 dark:border-orange-500/10 mt-8">
                  <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-2 font-bold text-sm uppercase tracking-widest text-orange-600">
                      <Lightbulb size={18} />
                      Expert Guidance
                    </div>
                    <h3 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Industry Best Practices</h3>
                    <p className="text-gray-600 dark:text-gray-400 font-medium max-w-2xl mx-auto">
                      Refine your professional narrative with these proven strategies for success.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {GENERAL_TIPS.map((tip, i) => (
                      <div key={i} className="space-y-3 p-6 bg-white dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-all">
                        <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full" />
                          {tip.title}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
                          {tip.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {isHistoryOpen && (
          <History
            records={history}
            onSelect={selectFromHistory}
            onDelete={deleteFromHistory}
            onClose={() => setIsHistoryOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isGeneratorOpen && (
          <ProfilePictureGenerator
            onClose={() => setIsGeneratorOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Footer Removed */}
    </div>
  );
}
