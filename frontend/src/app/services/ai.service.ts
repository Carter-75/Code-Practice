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
    // Environmental "Burn-In" Toggles
    const isProd = '__PRODUCTION__' === 'true';
    const prodBackend = '__PROD_BACKEND_URL__';
    const prodFrontend = '__PROD_FRONTEND_URL__';
    
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    
    // Explicit Local vs Production logic
    if (isLocal && !isProd) {
      return 'http://localhost:3000/api/ai';
    }

    if (prodBackend && !prodBackend.startsWith('__')) {
      return `${prodBackend}/api/ai`;
    }

    // Default: relative path
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
