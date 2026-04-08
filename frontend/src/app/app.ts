import { Component, signal, viewChild, ElementRef, afterNextRender, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as Matter from 'matter-js';
import anime from 'animejs';
import confetti from 'canvas-confetti';
import { AiService, QuestionResult, EvaluationResult } from './services/ai.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnDestroy {
  private aiService = inject(AiService);
  
  // UI State Signals
  protected readonly title = signal('AI Practice Trainer');
  protected readonly question = signal<QuestionResult | null>(null);
  protected readonly userCode = signal('');
  protected readonly feedback = signal<EvaluationResult | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly difficulty = signal<string>(localStorage.getItem('difficulty') || 'medium');

  protected onDifficultyChange(newVal: string) {
    this.difficulty.set(newVal);
    localStorage.setItem('difficulty', newVal);
  }

  private container = viewChild<ElementRef<HTMLDivElement>>('scene');
  private card = viewChild<ElementRef<HTMLDivElement>>('card');
  private engine?: Matter.Engine;
  private render?: Matter.Render;
  private runner?: Matter.Runner;

  constructor() {
    afterNextRender(() => {
      this.initPhysics();
      this.initEntranceAnimation();
      window.addEventListener('resize', this.handleResize);
    });
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.handleResize);
    if (this.render) {
      Matter.Render.stop(this.render);
      if (this.render.canvas.parentNode) {
        this.render.canvas.parentNode.removeChild(this.render.canvas);
      }
    }
    if (this.runner) Matter.Runner.stop(this.runner);
    if (this.engine) Matter.Engine.clear(this.engine);
  }

  private handleResize = () => {
    const el = this.container()?.nativeElement;
    if (el && this.render) {
      this.render.canvas.width = el.clientWidth;
      this.render.canvas.height = el.clientHeight;
      this.render.options.width = el.clientWidth;
      this.render.options.height = el.clientHeight;
    }
  };

  protected async generateQuestion() {
    this.isLoading.set(true);
    this.feedback.set(null);
    this.aiService.getQuestion(this.difficulty()).subscribe({
      next: (res) => {
        this.question.set(res);
        this.isLoading.set(false);
        this.spawnPhysicsObjects(5);
        this.animateInQuestion();
      },
      error: () => {
        this.isLoading.set(false);
        alert('Failed to generate question. Check your API key.');
      }
    });
  }

  protected async checkSolution() {
    if (!this.question() || !this.userCode()) return;
    
    this.isLoading.set(true);
    this.aiService.evaluateSolution(this.question()!.problem, this.userCode()).subscribe({
      next: (res) => {
        this.feedback.set(res);
        this.isLoading.set(false);
        const isSuccessful = res.status === 'CORRECT' || res.status === 'MOSTLY_CORRECT';
        
        if (isSuccessful) {
          this.celebrate();
          this.explodePhysicsObjects();
        } else {
          this.shakeCard();
        }
      },
      error: () => {
        this.isLoading.set(false);
        alert('Evaluation failed.');
      }
    });
  }

  private celebrate() {
    confetti({ 
      particleCount: 150, 
      spread: 70, 
      origin: { y: 0.6 },
      colors: ['#6366f1', '#a855f7', '#ec4899']
    });
  }

  private initPhysics() {
    const el = this.container()?.nativeElement;
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
    const wallLeft = Matter.Bodies.rectangle(-10, el.clientHeight / 2, 20, el.clientHeight, { isStatic: true });
    const wallRight = Matter.Bodies.rectangle(el.clientWidth + 10, el.clientHeight / 2, 20, el.clientHeight, { isStatic: true });

    Matter.World.add(this.engine.world, [ground, wallLeft, wallRight]);
    
    this.runner = Matter.Runner.create();
    Matter.Runner.run(this.runner, this.engine);
    Matter.Render.run(this.render);
  }

  private spawnPhysicsObjects(count: number) {
    if (!this.engine) return;
    const el = this.container()?.nativeElement;
    if (!el) return;

    for (let i = 0; i < count; i++) {
      const x = Math.random() * el.clientWidth;
      const size = Math.random() * 20 + 10;
      const isCircle = Math.random() > 0.5;
      
      const body = isCircle 
        ? Matter.Bodies.circle(x, -50, size/2, { restitution: 0.6, render: { fillStyle: '#6366f1' } })
        : Matter.Bodies.rectangle(x, -50, size, size, { restitution: 0.6, render: { fillStyle: '#a855f7' } });
      
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
