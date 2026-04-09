import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface EvaluationResult {
  status: 'CORRECT' | 'MOSTLY_CORRECT' | 'PARTIAL' | 'INCORRECT';
  explanation: string;
  issues?: string[];
  correctSolution: string;
  encouragement: string;
  visualAidUrl?: string;
  lineFixes?: string;
}

export interface QuestionResult {
  title: string;
  topicId: number;
  language: string;
  difficulty: string;
  type: 'code' | 'mcq' | 'drawing' | 'text';
  problem: string;
  imageUrl?: string;
  options?: string[];
  initialCode?: string;
  solution?: string | number;
  explanation?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private http = inject(HttpClient);
  
  // Dynamic API URL mapping
  private get apiUrl(): string {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    
    // Fallback logic: 
    // If we are on localhost, always use the local backend.
    if (isLocal) {
      return 'http://localhost:3000/api/ai';
    }

    // --- Production Configuration ---
    // If you have a deployed backend, put the URL here.
    // If this is blank, it will fallback to a relative path '/api/ai'
    const PROD_BACKEND_URL = ''; 
    
    if (PROD_BACKEND_URL) {
      return `${PROD_BACKEND_URL}/api/ai`;
    }

    // Default: relative path (assumes frontend and backend are on same domain/proxy)
    return '/api/ai';
  }

  getQuestion(difficulty: string = 'medium', languages: string[] = []): Observable<QuestionResult> {
    const langParam = languages.length > 0 ? `&languages=${languages.join(',')}` : '';
    return this.http.get<QuestionResult>(`${this.apiUrl}/question?difficulty=${difficulty}${langParam}`);
  }

  evaluateSolution(question: string, userCode: string, type: string = 'code'): Observable<EvaluationResult> {
    return this.http.post<EvaluationResult>(`${this.apiUrl}/check`, {
      question,
      userCode,
      type
    });
  }

  skipQuestion(): Observable<any> {
    return this.http.post(`${this.apiUrl}/skip`, {});
  }

  submitFeedback(feedback: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/feedback`, { feedback });
  }

  getAvailableLanguages(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/languages`);
  }
}
