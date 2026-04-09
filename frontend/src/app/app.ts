import { Component, signal, effect, ElementRef, viewChild, inject, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AiService, QuestionResult, EvaluationResult } from './services/ai.service';
import anime from 'animejs';
import Matter from 'matter-js';
import confetti from 'canvas-confetti';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './app.html',
})
export class App implements AfterViewInit {
  private aiService = inject(AiService);

  // Core State Signals
  title = signal('AI PRACTICE TRAINER V2');
  difficulty = signal(localStorage.getItem('appDifficulty') || 'medium');
  selectedLanguages = signal<string[]>(JSON.parse(localStorage.getItem('selectedTopics') || '["javascript", "python", "java", "sql", "mongoose", "mongo_db", "authentication"]'));
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
  scene = viewChild<ElementRef>('scene');
  header = viewChild<ElementRef>('header');
  card = viewChild<ElementRef>('card');
  drawingCanvas = viewChild<ElementRef>('drawingCanvas');

  // Physics Engine
  private engine?: Matter.Engine;
  private render?: Matter.Render;
  private runner?: Matter.Runner;

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
        this.spawnPhysicsObjects(20);
      } else if (this.feedback()?.status === 'INCORRECT') {
        this.shakeCard();
      }
    });
  }

  ngAfterViewInit() {
    this.initPhysics();
    this.initEntranceAnimation();
    this.loadAvailableLanguages();
  }

  loadAvailableLanguages() {
    this.aiService.getAvailableLanguages().subscribe(langs => {
      this.allLanguages.set(langs);
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

    this.aiService.getQuestion(this.difficulty(), this.selectedLanguages()).subscribe({
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
    this.explodePhysicsObjects();
    this.generateQuestion();
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
    this.aiService.evaluateSolution(this.question()!.problem, submission, this.question()!.type).subscribe({
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
    this.aiService.submitFeedback(this.userFeedbackText()).subscribe({
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

  startDrawing(event: MouseEvent) {
    this.isDrawing = true;
    this.draw(event);
  }

  stopDrawing() {
    this.isDrawing = false;
    this.ctx?.beginPath();
  }

  draw(event: MouseEvent) {
    if (!this.isDrawing || !this.ctx) return;
    const canvas = this.drawingCanvas()?.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
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

  // Physics logic remains the same (truncated in this snippet for brevity, but I will preserve it in the actual file)
  private initPhysics() {
    const el = this.scene()?.nativeElement;
    if (!el) return;

    this.engine = Matter.Engine.create();
    this.render = Matter.Render.create({
      element: el,
      engine: this.engine,
      options: {
        width: el.clientWidth,
        height: el.clientHeight || 400,
        background: 'transparent',
        wireframes: false
      }
    });

    const ground = Matter.Bodies.rectangle(el.clientWidth / 2, el.clientHeight + 10, el.clientWidth, 20, { isStatic: true });
    Matter.World.add(this.engine.world, [ground]);
    
    this.runner = Matter.Runner.create();
    Matter.Runner.run(this.runner, this.engine);
    Matter.Render.run(this.render);
  }

  private spawnPhysicsObjects(count: number) {
    if (!this.engine) return;
    const el = this.scene()?.nativeElement;
    if (!el) return;

    for (let i = 0; i < count; i++) {
      const x = Math.random() * el.clientWidth;
      const size = Math.random() * 20 + 10;
      const body = Matter.Bodies.circle(x, -50, size/2, { restitution: 0.6, render: { fillStyle: '#6366f1' } });
      Matter.World.add(this.engine.world, body);
    }
  }

  private explodePhysicsObjects() {
    if (!this.engine) return;
    const bodies = Matter.Composite.allBodies(this.engine.world).filter(b => !b.isStatic);
    bodies.forEach(body => {
      Matter.Body.applyForce(body, body.position, {
        x: (Math.random() - 0.5) * 0.1,
        y: -Math.random() * 0.2
      });
    });
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
