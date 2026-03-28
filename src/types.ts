export interface JobRecommendation {
  role: string;
  missingSkills: string[];
  matchPercentage: number;
}

export interface ResumeAnalysis {
  predictedRole: string;
  recommendations: JobRecommendation[];
  resumeScore: number;
  summary: string;
  improvements: string[];
}

export interface ImageGenerationState {
  isLoading: boolean;
  error: string | null;
  imageUrl: string | null;
}

export interface AnalysisRecord extends ResumeAnalysis {
  id: string;
  userId: string;
  fileName?: string;
  createdAt: any; // Firestore Timestamp
}

export interface AnalysisState {
  isLoading: boolean;
  error: string | null;
  result: ResumeAnalysis | null;
}
