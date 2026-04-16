import { Component, signal, effect, ElementRef, viewChild, inject, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { ApiService, QuestionResult, EvaluationResult } from './services/api.service';
import anime from 'animejs';
import confetti from 'canvas-confetti';
import * as Matter from 'matter-js';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './app.html',
})
export class App implements AfterViewInit {
  private apiService = inject(ApiService);

  // Core State Signals
  title = signal('AI PRACTICE TRAINER V2');
  difficulty = signal(localStorage.getItem('appDifficulty') || 'medium');
  selectedLanguages = signal<string[]>(JSON.parse(localStorage.getItem('selectedTopics') || '["javascript", "python", "java", "sql", "mongoose", "mongo_db", "angular", "auth_security"]'));
  allLanguages = signal<string[]>([]);
  question = signal<QuestionResult | null>(null);
  userCode = signal('');
  feedback = signal<EvaluationResult | null>(null);
  isLoading = signal(false);
  
  // Feedback System
  userFeedbackText = signal('');
  showFeedbackInput = signal(false);
  showReferenceImage = signal(false);
  drawingMode = signal<'canvas' | 'text'>('canvas');
  isTopicDropdownOpen = signal(false);
  isDifficultyDropdownOpen = signal(false);

  // Template Refs
  header = viewChild<ElementRef>('header');
  card = viewChild<ElementRef>('card');
  drawingCanvas = viewChild<ElementRef>('drawingCanvas');



  // Drawing State
  private ctx?: CanvasRenderingContext2D;
  private isDrawing = false;

  constructor() {
    effect(() => {
      if (this.feedback()?.status === 'CORRECT') {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#a855f7', '#ec4899']
        });
      } else if (this.feedback()?.status === 'INCORRECT') {
        this.shakeCard();
      }
    });
  }

  ngAfterViewInit() {
    this.initEntranceAnimation();
    this.loadAvailableLanguages();
  }

  loadAvailableLanguages() {
    this.apiService.getData<string[]>('ai/languages').subscribe(langs => {
      this.allLanguages.set(langs);
      
      // Clean up orphaned topics from localStorage
      const currentSelected = this.selectedLanguages();
      const validSelected = currentSelected.filter(lang => langs.includes(lang));
      
      if (currentSelected.length !== validSelected.length) {
        this.selectedLanguages.set(validSelected);
        this.onLanguagesChange();
      }
    });
  }

  // Topic Management
  onLanguagesChange() {
    localStorage.setItem('selectedTopics', JSON.stringify(this.selectedLanguages()));
  }

  toggleTopic(topic: string) {
    const current = this.selectedLanguages();
    if (current.includes(topic)) {
      this.selectedLanguages.set(current.filter(t => t !== topic));
    } else {
      this.selectedLanguages.set([...current, topic]);
    }
    this.onLanguagesChange();
  }

  isTopicSelected(topic: string): boolean {
    return this.selectedLanguages().includes(topic);
  }

  // Question Management
  async generateQuestion() {
    if (this.isLoading()) return;
    
    this.isLoading.set(true);
    this.feedback.set(null);
    this.userCode.set('');
    this.showReferenceImage.set(false);
    this.clearCanvas();

    const langParam = this.selectedLanguages().length > 0 ? `&languages=${this.selectedLanguages().join(',')}` : '';
    const endpoint = `ai/question?difficulty=${this.difficulty()}${langParam}`;

    this.apiService.getData<QuestionResult>(endpoint).subscribe({
      next: (res) => {
        this.question.set(res);
        this.isLoading.set(false);
        this.animateInQuestion();
        if (res.type === 'drawing') {
          setTimeout(() => this.initCanvas(), 100);
        }
      },
      error: (err) => {
        console.error(err);
        this.isLoading.set(false);
      }
    });
  }

  async skipQuestion() {
    this.generateQuestion();
  }

  retryQuestion() {
    this.feedback.set(null);
    this.showFeedbackInput.set(false);
    this.animateInQuestion();
  }

  onDifficultyChange(newDifficulty: string) {
    this.difficulty.set(newDifficulty);
    localStorage.setItem('appDifficulty', newDifficulty);
  }

  setDrawingMode(mode: 'canvas' | 'text') {
    this.drawingMode.set(mode);
    if (mode === 'canvas') {
      setTimeout(() => this.initCanvas(), 100);
    }
  }

  // Answer Handling
  selectMcqOption(index: number) {
    this.userCode.set(index.toString());
    this.checkSolution();
  }

  async checkSolution() {
    if (this.isLoading() || !this.question()) return;

    let submission = this.userCode();
    if (this.question()?.type === 'drawing') {
      submission = this.drawingCanvas()?.nativeElement.toDataURL() || 'no-drawing';
    }

    this.isLoading.set(true);
    this.apiService.postData<EvaluationResult>('ai/check', { question: this.question()!.problem, userCode: submission, type: this.question()!.type }).subscribe({
      next: (res) => {
        this.feedback.set(res);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.isLoading.set(false);
      }
    });
  }

  // AI Feedback Reflection
  async submitFeedback() {
    if (!this.userFeedbackText()) return;
    
    this.isLoading.set(true);
    this.apiService.postData<any>('ai/feedback', { feedback: this.userFeedbackText() }).subscribe({
      next: (res) => {
        this.userFeedbackText.set('');
        this.showFeedbackInput.set(false);
        this.isLoading.set(false);
        this.explodePhysicsObjects();
        alert('AI Consensus: ' + res.message);
      },
      error: () => this.isLoading.set(false)
    });
  }

  // Physics Explosion Logic
  public explodePhysicsObjects() {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);

    const engine = Matter.Engine.create();
    const render = Matter.Render.create({
      canvas: canvas,
      engine: engine,
      options: {
        width: window.innerWidth,
        height: window.innerHeight,
        background: 'transparent',
        wireframes: false
      }
    });

    const bodies = [];
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    for (let i = 0; i < 20; i++) {
      const x = centerX + (Math.random() - 0.5) * 50;
      const y = centerY + (Math.random() - 0.5) * 50;
      const size = Math.random() * 20 + 10;
      
      const body = i % 2 === 0 
        ? Matter.Bodies.circle(x, y, size / 2, {
            render: { fillStyle: i % 3 === 0 ? '#818cf8' : '#c084fc' }
          })
        : Matter.Bodies.rectangle(x, y, size, size, {
            render: { fillStyle: i % 3 === 1 ? '#f472b6' : '#6366f1' }
          });

      const force = {
        x: (Math.random() - 0.5) * 0.1,
        y: (Math.random() - 0.7) * 0.1
      };
      
      Matter.Body.applyForce(body, body.position, force);
      bodies.push(body);
    }

    Matter.World.add(engine.world, bodies);
    Matter.Render.run(render);
    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);

    // Fade out and cleanup
    anime({
      targets: canvas,
      opacity: [1, 0],
      duration: 3000,
      easing: 'easeInQuad',
      complete: () => {
        Matter.Render.stop(render);
        Matter.Engine.clear(engine);
        render.canvas.remove();
        render.textures = {};
      }
    });
  }

  // Drawing Logic
  private initCanvas() {
    const canvas = this.drawingCanvas()?.nativeElement;
    if (!canvas) return;
    this.ctx = canvas.getContext('2d');
    if (this.ctx) {
      this.ctx.strokeStyle = '#818cf8';
      this.ctx.lineWidth = 3;
      this.ctx.lineCap = 'round';
    }
  }

  startDrawing(event: MouseEvent | TouchEvent) {
    this.isDrawing = true;
    this.draw(event);
  }

  stopDrawing() {
    this.isDrawing = false;
    this.ctx?.beginPath();
  }

  draw(event: MouseEvent | TouchEvent) {
    if (!this.isDrawing || !this.ctx) return;
    const canvas = this.drawingCanvas()?.nativeElement;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    let x, y;

    if (event instanceof MouseEvent) {
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
    } else {
      x = event.touches[0].clientX - rect.left;
      y = event.touches[0].clientY - rect.top;
    }

    // Scale coordinates if canvas style differs from internal resolution
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const finalX = x * scaleX;
    const finalY = y * scaleY;

    this.ctx.lineTo(finalX, finalY);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(finalX, finalY);
  }

  clearCanvas() {
    if (this.ctx && this.drawingCanvas()) {
      const canvas = this.drawingCanvas()!.nativeElement;
      this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // Click Outside Handler
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    
    // Check if click is inside specific dropdown areas
    const isTopicClick = target.closest('.topic-dropdown-container');
    const isDifficultyClick = target.closest('.difficulty-dropdown-container');

    if (!isTopicClick) this.isTopicDropdownOpen.set(false);
    if (!isDifficultyClick) this.isDifficultyDropdownOpen.set(false);
  }



  setDifficulty(level: string) {
    this.difficulty.set(level);
    localStorage.setItem('appDifficulty', level);
    this.isDifficultyDropdownOpen.set(false);
  }

  private initEntranceAnimation() {
    const cardEl = this.card()?.nativeElement;
    if (cardEl) {
      anime({
        targets: cardEl,
        translateY: [20, 0],
        opacity: [0, 1],
        duration: 1000,
        easing: 'easeOutElastic(1, .8)'
      });
    }
  }

  private animateInQuestion() {
    anime({
      targets: '.question-area',
      opacity: [0, 1],
      translateX: [-10, 0],
      duration: 500,
      easing: 'easeOutQuad'
    });
  }

  private shakeCard() {
    const cardEl = this.card()?.nativeElement;
    if (cardEl) {
      anime({
        targets: cardEl,
        translateX: [0, -10, 10, -10, 10, 0],
        duration: 400,
        easing: 'easeInOutQuad'
      });
    }
  }
}
