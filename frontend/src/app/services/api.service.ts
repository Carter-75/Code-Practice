import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

export interface EvaluationResult {
  status: 'CORRECT' | 'MOSTLY_CORRECT' | 'PARTIAL' | 'INCORRECT';
  explanation: string;
  issues?: string[];
  correctSolution: string;
  encouragement: string;
  visualAidUrl?: string;
}

/**
 * Universal API Bridge
 */
@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  
  private get apiUrl(): string {
    // Environmental "Burn-In" Toggles
    const isProd = ('__PRODUCTION__' as string) === 'true';
    
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    
    // In local development, use the direct local backend port
    if (isLocal && !isProd) {
      return 'http://localhost:3000/api';
    }

    // In production, use the universal relative path (handled by Vercel Proxy)
    return '/api';
  }

  /**
   * Universal GET wrapper
   */
  getData<T>(endpoint: string): Observable<T> {
    return this.http.get<T>(`${this.apiUrl}/${endpoint}`);
  }

  /**
   * Universal POST wrapper
   */
  postData<T>(endpoint: string, body: any): Observable<T> {
    return this.http.post<T>(`${this.apiUrl}/${endpoint}`, body);
  }
}
