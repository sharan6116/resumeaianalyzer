import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, RefreshCw, Download, X, Sparkles, User, Briefcase, Palette, Image as ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { generateProfilePicture } from '../services/imageService';
import { ImageGenerationState } from '../types';

const STYLES = [
  { id: 'corporate', label: 'Corporate Professional', icon: Briefcase, prompt: 'A professional corporate headshot with clean lighting and a confident look.' },
  { id: 'creative', label: 'Creative/Artistic', icon: Palette, prompt: 'A creative and artistic headshot with modern, slightly stylized lighting.' },
  { id: 'minimalist', label: 'Minimalist', icon: User, prompt: 'A minimalist, clean headshot with a simple, high-key aesthetic.' },
  { id: 'tech', label: 'Tech/Modern', icon: Sparkles, prompt: 'A modern, tech-focused headshot with a contemporary, professional feel.' },
];

const BACKGROUNDS = [
  { id: 'office', label: 'Modern Office', prompt: 'A blurred modern office background with natural light.' },
  { id: 'studio', label: 'Studio Neutral', prompt: 'A solid, neutral studio background (light gray or off-white).' },
  { id: 'nature', label: 'Outdoor/Nature', prompt: 'A soft, blurred outdoor natural background with greenery.' },
  { id: 'solid', label: 'Solid Color', prompt: 'A clean, solid professional color background.' },
];

interface ProfilePictureGeneratorProps {
  onClose: () => void;
}

export default function ProfilePictureGenerator({ onClose }: ProfilePictureGeneratorProps) {
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0].id);
  const [selectedBackground, setSelectedBackground] = useState(BACKGROUNDS[0].id);
  const [description, setDescription] = useState('');
  const [generation, setGeneration] = useState<ImageGenerationState>({
    isLoading: false,
    error: null,
    imageUrl: null,
  });

  const handleGenerate = async () => {
    setGeneration({ isLoading: true, error: null, imageUrl: null });
    try {
      const styleObj = STYLES.find(s => s.id === selectedStyle);
      const bgObj = BACKGROUNDS.find(b => b.id === selectedBackground);
      
      const url = await generateProfilePicture({
        style: styleObj?.prompt || STYLES[0].prompt,
        background: bgObj?.prompt || BACKGROUNDS[0].prompt,
        description,
      });
      
      setGeneration({ isLoading: false, error: null, imageUrl: url });
    } catch (err: any) {
      console.error(err);
      setGeneration({
        isLoading: false,
        error: err.message || 'Failed to generate profile picture. Please try again.',
        imageUrl: null,
      });
    }
  };

  const downloadImage = () => {
    if (!generation.imageUrl) return;
    const link = document.createElement('a');
    link.href = generation.imageUrl;
    link.download = `AI_Profile_Picture_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white dark:bg-[#0A0A0A] w-full max-w-4xl rounded-[2.5rem] overflow-hidden shadow-2xl border border-black/10 dark:border-white/10 flex flex-col md:flex-row max-h-[90vh]"
      >
        {/* Left Side: Controls */}
        <div className="flex-1 p-8 md:p-12 space-y-8 overflow-y-auto custom-scrollbar">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <h2 className="text-3xl font-bold dark:text-white flex items-center gap-2">
                <Camera className="text-orange-600" />
                AI Profile Picture
              </h2>
              <p className="text-gray-500 font-medium">Generate a professional headshot in seconds.</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors md:hidden">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 flex items-center gap-2">
                <Palette size={14} /> Choose Style
              </label>
              <div className="grid grid-cols-2 gap-3">
                {STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={cn(
                      "p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-3",
                      selectedStyle === style.id
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-900/10 text-orange-600"
                        : "border-black/5 dark:border-white/5 hover:border-orange-200 dark:hover:border-orange-900/30"
                    )}
                  >
                    <style.icon size={18} />
                    <span className="font-bold text-sm">{style.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 flex items-center gap-2">
                <ImageIcon size={14} /> Background
              </label>
              <div className="grid grid-cols-2 gap-3">
                {BACKGROUNDS.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => setSelectedBackground(bg.id)}
                    className={cn(
                      "p-4 rounded-2xl border-2 text-left transition-all",
                      selectedBackground === bg.id
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-900/10 text-orange-600"
                        : "border-black/5 dark:border-white/5 hover:border-orange-200 dark:hover:border-orange-900/30"
                    )}
                  >
                    <span className="font-bold text-sm">{bg.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                Additional Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Wearing a dark blue suit, smiling slightly..."
                className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-black/5 dark:border-white/5 focus:ring-2 focus:ring-orange-500 outline-none transition-all resize-none h-24 font-medium"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={generation.isLoading}
              className={cn(
                "w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg",
                generation.isLoading && "opacity-50 cursor-not-allowed"
              )}
            >
              {generation.isLoading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw size={20} />
                  Generate Picture
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Side: Preview */}
        <div className="w-full md:w-[400px] bg-gray-50 dark:bg-white/5 p-8 md:p-12 flex flex-col items-center justify-center relative border-l border-black/5 dark:border-white/5">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors hidden md:block">
            <X size={24} />
          </button>

          <div className="w-full aspect-square max-w-[300px] rounded-[2rem] overflow-hidden bg-white dark:bg-gray-800 shadow-xl border border-black/5 dark:border-white/5 relative group">
            <AnimatePresence mode="wait">
              {generation.imageUrl ? (
                <motion.img
                  key="image"
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  src={generation.imageUrl}
                  alt="Generated Profile"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : generation.isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full flex flex-col items-center justify-center gap-4 p-8 text-center"
                >
                  <Loader2 className="w-12 h-12 text-orange-600 animate-spin" />
                  <p className="text-sm font-bold text-gray-500">Creating your professional look...</p>
                </motion.div>
              ) : (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full h-full flex flex-col items-center justify-center gap-4 p-8 text-center"
                >
                  <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                    <User size={48} />
                  </div>
                  <p className="text-sm font-bold text-gray-400">Your AI-generated picture will appear here.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {generation.imageUrl && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 w-full max-w-[300px]"
            >
              <button
                onClick={downloadImage}
                className="w-full py-3 bg-orange-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-orange-700 transition-colors shadow-lg shadow-orange-600/20"
              >
                <Download size={18} /> Download Photo
              </button>
              <p className="text-[10px] text-center text-gray-400 mt-3 font-bold uppercase tracking-widest">
                High Resolution • 1:1 Aspect Ratio
              </p>
            </motion.div>
          )}

          {generation.error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 text-xs font-bold text-red-500 text-center px-4"
            >
              {generation.error}
            </motion.p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
