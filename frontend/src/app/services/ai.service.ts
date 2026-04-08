import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface EvaluationResult {
  status: 'CORRECT' | 'MOSTLY_CORRECT' | 'PARTIAL' | 'INCORRECT';
  explanation: string;
  lineFixes: string;
  correctSolution: string;
  encouragement: string;
}

export interface QuestionResult {
  title: string;
  problem: string;
}

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/api/ai';

  getQuestion(difficulty: string = 'medium'): Observable<QuestionResult> {
    return this.http.get<QuestionResult>(`${this.apiUrl}/question?difficulty=${difficulty}`);
  }

  evaluateSolution(question: string, userCode: string, contextCode?: string): Observable<EvaluationResult> {
    return this.http.post<EvaluationResult>(`${this.apiUrl}/check`, {
      question,
      userCode,
      contextCode
    });
  }
}
