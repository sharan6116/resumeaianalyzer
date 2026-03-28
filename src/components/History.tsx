import React from 'react';
import { motion } from 'motion/react';
import { FileText, Calendar, Trash2, ArrowRight } from 'lucide-react';
import { AnalysisRecord } from '../types';

interface HistoryProps {
  records: AnalysisRecord[];
  onSelect: (record: AnalysisRecord) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function History({ records, onSelect, onDelete, onClose }: HistoryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed right-0 top-0 h-full w-full md:w-96 bg-white dark:bg-[#0A0A0A] border-l border-black/10 dark:border-white/10 z-[60] shadow-2xl flex flex-col"
    >
      <div className="p-6 border-b border-black/10 dark:border-white/10 flex justify-between items-center">
        <h2 className="text-xl font-bold dark:text-white">Analysis History</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-black dark:hover:text-white">
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {records.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <FileText className="mx-auto mb-4 opacity-20" size={48} />
            <p>No past analyses found.</p>
          </div>
        ) : (
          records.map((record) => (
            <div
              key={record.id}
              className="group bg-gray-50 dark:bg-white/5 p-4 rounded-2xl border border-black/5 dark:border-white/5 hover:border-orange-500/50 transition-all cursor-pointer relative"
              onClick={() => onSelect(record)}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 text-orange-600 font-bold text-[10px] uppercase tracking-widest">
                  <Calendar size={12} />
                  {record.createdAt?.toDate ? record.createdAt.toDate().toLocaleDateString() : 'Recent'}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(record.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white truncate pr-6">{record.predictedRole}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                <FileText size={10} />
                {record.fileName || 'Unnamed Resume'}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs font-bold text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full">
                  Score: {record.resumeScore}
                </span>
                <ArrowRight size={14} className="text-gray-400 group-hover:text-orange-500 transition-colors" />
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
