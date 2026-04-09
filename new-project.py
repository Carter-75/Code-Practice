#!/usr/bin/env python3
import os
import json
import subprocess
from pathlib import Path

def ask_input(prompt, default=None, validation_func=None, options=None):
    """
    Robust input loop that handles defaults and validation.
    Displays 'oops wrong input' on failure.
    """
    first_attempt = True
    while True:
        if not first_attempt:
            print("oops wrong input")
        
        display_prompt = f"{prompt}"
        if options:
            display_prompt += f" ({'/'.join(options)})"
        if default:
            display_prompt += f" [default: {default}]"
        
        user_input = input(f"{display_prompt}: ").strip()
        
        # Handle default
        if user_input == "" and default is not None:
            return default
            
        # Validation
        if not user_input and default is None:
            first_attempt = False
            continue
            
        if options and user_input not in options:
            first_attempt = False
            continue
            
        if validation_func and not validation_func(user_input):
            first_attempt = False
            continue
            
        return user_input

def main():
    print("--- Unified MEAN Project Generator (Angular + Express + Mongo) ---")
    print("      Features: Physics (Matter.js), Anime.js, Iframe Security\n")

    # 1. Gather Inputs
    project_name = ask_input(
        "Project Name", 
        validation_func=lambda x: x.replace("-", "").replace("_", "").isalnum()
    )
    
    fe_port = ask_input(
        "Frontend Port", 
        default="4200", 
        validation_func=lambda x: x.isdigit()
    )
    
    be_port = ask_input(
        "Backend Port", 
        default="3000", 
        validation_func=lambda x: x.isdigit()
    )
    
    css_choice = ask_input(
        "CSS Flavor / Framework", 
        default="tailwind", 
        options=["css", "scss", "bulma", "tailwind"]
    )
    
    use_matter = ask_input(
        "Do you want Matter.js?", 
        default="yes", 
        options=["yes", "no"]
    ) == "yes"

    use_anime = ask_input(
        "Do you want Anime.js?", 
        default="yes", 
        options=["yes", "no"]
    ) == "yes"

    use_confetti = ask_input(
        "Do you want Confetti?", 
        default="yes", 
        options=["yes", "no"]
    ) == "yes"

    ai_choice = ask_input(
        "Which AI tools do you want to configure?", 
        default="Agents.md", 
        options=["Agents.md", "Cursor", "Claude", "None"]
    )

    project_root = Path.cwd() / project_name
    if project_root.exists():
        print(f"Error: Directory {project_name} already exists.")
        return

    project_root.mkdir()
    backend_root = project_root / "backend"
    frontend_root = project_root / "frontend"
    backend_root.mkdir()
    frontend_root.mkdir()

    print(f"\nCreating project '{project_name}' in {project_root}...")

    # --- Backend Templates ---
    be_package_json = {
        "name": f"{project_name}-backend",
        "version": "1.0.0",
        "scripts": {
            "start": "node ./bin/www",
            "dev": "nodemon ./bin/www"
        },
        "dependencies": {
            "express": "^4.19.2",
            "cors": "^2.8.5",
            "cookie-parser": "~1.4.6",
            "debug": "~2.6.9",
            "morgan": "~1.10.0",
            "mongoose": "^8.0.0",
            "helmet": "^7.1.0",
            "dotenv": "^16.4.5"
        },
        "devDependencies": {
            "nodemon": "^3.1.0"
        }
    }

    be_app_js = """require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const mongoose = require('mongoose');
const helmet = require('helmet');

const indexRouter = require('./routes/index');

const app = express();

const PROJECT_NAME = process.env.PROJECT_NAME || 'Portfolio Project';

// --- MongoDB Setup ---
const mongoURI = process.env.MONGODB_URI;
    if (mongoURI) {
  mongoose.connect(mongoURI)
    .then(() => console.log('OK: Connected to MongoDB'))
    .catch(err => {
      console.error('WARN: MongoDB Connection Error (Graceful):', err.message);
      console.log('INFO: Continuing without database features...');
    });
} else {
  console.log('INFO: No MONGODB_URI found in .env. Database features disabled.');
}

// --- Middlewares ---
app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// --- Portfolio Iframe Security ---
const isProd = process.env.PRODUCTION === 'true';
const prodUrl = process.env.PROD_FRONTEND_URL;

const frameAncestors = ["'self'", "https://carter-portfolio.fyi", "https://carter-portfolio.vercel.app", "https://*.vercel.app", `http://localhost:${process.env.PORT || '{be_port}'}`];
if (isProd && prodUrl) {
  frameAncestors.push(prodUrl);
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "frame-ancestors": frameAncestors,
    },
  },
}));

app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'ALLOWALL'); // For compatibility
  next();
});

app.get('/', (req, res) => {
  res.send(`API for ${PROJECT_NAME} is running at /api`);
});

app.use('/api', indexRouter);

// Error handler
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    message: err.message,
    error: req.app.get('env') === 'development' ? err : {}
  });
});

module.exports = app;
"""

    be_www = """#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const app = require('../app');
const http = require('http');

const port = process.env.PORT || '3000';
app.set('port', port);

const server = http.createServer(app);
server.listen(port, () => {
  console.log(`Backend listening on port ${port} (Project: ${process.env.PROJECT_NAME})`);
});
"""

    be_routes_index = """const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'Welcome to the API' });
});

module.exports = router;
"""

    # --- Frontend Templates (MEAN / Angular v21) ---
    fe_deps = {
        "@angular/common": "^21.2.0",
        "@angular/compiler": "^21.2.0",
        "@angular/core": "^21.2.0",
        "@angular/forms": "^21.2.0",
        "@angular/platform-browser": "^21.2.0",
        "@angular/router": "^21.2.0",
        "rxjs": "~7.8.0",
        "tslib": "^2.3.0"
    }
    
    fe_dev_deps = {
        "@angular/build": "^21.2.7",
        "@angular/cli": "^21.2.7",
        "@angular/compiler-cli": "^21.2.0",
        "jsdom": "^28.0.0",
        "prettier": "^3.8.1",
        "typescript": "~5.9.2",
        "vitest": "^4.0.8"
    }

    if css_choice == "tailwind":
        fe_dev_deps.update({"tailwindcss": "^3.4.1", "postcss": "^8.4.35", "autoprefixer": "^10.4.18"})
    elif css_choice == "bulma":
        fe_deps.update({"bulma": "^1.0.1"})

    if use_matter:
        fe_deps.update({"matter-js": "^0.19.0"})
        fe_dev_deps.update({"@types/matter-js": "^0.19.6"})
    
    if use_anime:
        fe_deps.update({"animejs": "^3.2.2"})
        fe_dev_deps.update({"@types/animejs": "^3.1.12"})

    if use_confetti:
        fe_deps.update({"canvas-confetti": "^1.9.3"})
        fe_dev_deps.update({"@types/canvas-confetti": "^1.6.4"})

    fe_package_json = {
        "name": f"{project_name}-frontend",
        "version": "0.0.0",
        "scripts": {
            "ng": "ng",
            "start": "ng serve",
            "build": "ng build",
            "watch": "ng build --watch --configuration development",
            "test": "vitest"
        },
        "private": True,
        "dependencies": fe_deps,
        "devDependencies": fe_dev_deps
    }

    # Styles extension
    style_ext = "css"
    if css_choice == "scss": style_ext = "scss"

    fe_angular_json = {
        "version": 1,
        "projects": {
            "frontend": {
                "projectType": "application",
                "root": "",
                "sourceRoot": "src",
                "prefix": "app",
                "architect": {
                    "build": {
                        "builder": "@angular/build:application",
                        "options": {
                            "outputPath": "dist/frontend/browser",
                            "index": "src/index.html",
                            "browser": "src/main.ts",
                            "tsConfig": "tsconfig.app.json",
                            "assets": [
                                { "glob": "**/*", "input": "public" }
                            ],
                            "styles": [f"src/styles.{style_ext}"]
                        },
                        "configurations": {
                            "production": {
                                "budgets": [
                                    { "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" },
                                    { "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" }
                                ],
                                "outputHashing": "all"
                            },
                            "development": {
                                "optimization": False,
                                "extractLicenses": False,
                                "sourceMap": True
                            }
                        },
                        "defaultConfiguration": "production"
                    },
                    "serve": {
                        "builder": "@angular/build:dev-server",
                        "options": {
                            "buildTarget": "frontend:build",
                            "port": int(fe_port)
                        },
                        "configurations": {
                            "production": {
                                "buildTarget": "frontend:build:production"
                            },
                            "development": {
                                "buildTarget": "frontend:build:development"
                            }
                        },
                        "defaultConfiguration": "development"
                    }
                }
            }
        }
    }

    # --- Tailwind Config (if selected) ---
    fe_tailwind_config = """/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
"""
    fe_postcss_config = """module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  }
}
"""

    fe_main_ts = """import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
"""

    fe_app_config_ts = """import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient()
  ]
};
"""

    fe_app_routes_ts = "import { Routes } from '@angular/router';\n\nexport const routes: Routes = [];\n"

    # --- Frontend Tooling Templates ---
    fe_tsconfig_json = {
        "compilerOptions": {
            "strict": True,
            "noImplicitOverride": True,
            "noPropertyAccessFromIndexSignature": True,
            "noImplicitReturns": True,
            "noFallthroughCasesInSwitch": True,
            "skipLibCheck": True,
            "isolatedModules": True,
            "experimentalDecorators": True,
            "importHelpers": True,
            "target": "ES2022",
            "module": "preserve",
            "moduleResolution": "bundler",
            "sourceMap": True
        },
        "angularCompilerOptions": {
            "enableI18nLegacyMessageIdFormat": False,
            "strictInjectionParameters": True,
            "strictInputAccessModifiers": True,
            "strictTemplates": True
        },
        "files": [],
        "references": [{ "path": "./tsconfig.app.json" }]
    }

    fe_prettierrc = """{
  "printWidth": 100,
  "singleQuote": true,
  "overrides": [
    {
      "files": "*.html",
      "options": {
        "parser": "angular"
      }
    }
  ]
}
"""

    fe_editorconfig = """# Editor configuration
root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.ts]
quote_type = single
ij_typescript_use_double_quotes = false

[*.md]
max_line_length = off
trim_trailing_whitespace = false
"""

    fe_vscode_extensions = {
        "recommendations": [
            "angular.ng-template",
            "esbenp.prettier-vscode",
            "firsttris.vscode-jest-runner"
        ]
    }

    fe_readme = f"""# {project_name}

A full-stack MEAN application (MongoDB, Express, Angular, Node) generated with a premium portfolio template.

## Features
- **Frontend**: Angular v21 (Standalone, Signals)
- **Backend**: Node/Express with Graceful MongoDB
- **Security**: Iframe protection for portfolio embedding
- **Interactive**: Matter.js physics and Anime.js animations

## Getting Started

### 1. Configure Environment
A `.env` file is located at the root. Update your `MONGODB_URI` if needed.

### 2. Run Backend
```bash
cd backend
npm start
```

### 3. Run Frontend
```bash
cd frontend
npm start
```
"""

    # Component imports and logic
    imports_list = ["Component", "signal"]
    if use_matter or use_anime or use_confetti:
        imports_list.extend(["viewChild", "ElementRef", "afterNextRender", "OnDestroy"])
    
    physics_imports = f"import {{ {', '.join(imports_list)} }} from '@angular/core';\n"
    if use_matter: physics_imports += "import * as Matter from 'matter-js';\n"
    if use_anime: physics_imports += "import anime from 'animejs';\n"
    if use_confetti: physics_imports += "import confetti from 'canvas-confetti';\n"

    physics_variables = ""
    if use_matter:
        physics_variables += "  private engine?: Matter.Engine;\n  private render?: Matter.Render;\n"
    
    physics_init_calls = ""
    if use_matter: physics_init_calls += "      this.initPhysics();\n"
    if use_anime: physics_init_calls += "      this.initAnimation();\n"

    physics_logic = ""
    if use_matter or use_anime or use_confetti:
        physics_logic += f"""
  private container = viewChild<ElementRef<HTMLDivElement>>('scene');
  private card = viewChild<ElementRef<HTMLDivElement>>('card');
{physics_variables}
  constructor() {{
    afterNextRender(() => {{
{physics_init_calls}
      if ({'true' if use_matter else 'false'}) window.addEventListener('resize', this.handleResize);
    }});
  }}

  ngOnDestroy() {{
    if ({'true' if use_matter else 'false'}) window.removeEventListener('resize', this.handleResize);
    {"if (this.render) { Matter.Render.stop(this.render); if (this.render.canvas.parentNode) { this.render.canvas.parentNode.removeChild(this.render.canvas); } }" if use_matter else ""}
    {"if (this.engine) Matter.Engine.clear(this.engine);" if use_matter else ""}
  }}

  private handleResize = () => {{
    const el = this.container()?.nativeElement;
    if (el && {'this.render' if use_matter else 'false'}) {{
      {( 'this.render.canvas.width = el.clientWidth; this.render.options.width = el.clientWidth;' if use_matter else '')}
    }}
  }};

  protected celebrate() {{
    { 'confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });' if use_confetti else "console.log('Confetti is disabled');" }
  }}
"""
    else:
        physics_logic = """
  protected celebrate() {
    console.log('Confetti is disabled');
  }
"""
    if use_anime:
        physics_logic += """
  private initAnimation() {
    const el = this.card()?.nativeElement;
    if (el) {
      anime({
        targets: el,
        scale: [1, 1.02],
        direction: 'alternate',
        easing: 'easeInOutSine',
        duration: 1400,
        loop: true
      });
    }
  }
"""
    if use_matter:
        physics_logic += """
  private initPhysics() {
    const el = this.container()?.nativeElement;
    if (!el) return;

    this.engine = Matter.Engine.create();
    this.render = Matter.Render.create({
      element: el,
      engine: this.engine,
      options: {
        width: el.clientWidth,
        height: 220,
        background: 'transparent',
        wireframes: false
      }
    });

    const ground = Matter.Bodies.rectangle(el.clientWidth / 2, 210, el.clientWidth, 20, { 
      isStatic: true,
      render: { fillStyle: '#d1d5db' }
    });
    
    const ball = Matter.Bodies.circle(80, 30, 20, { 
      restitution: 0.85,
      render: { fillStyle: '#ffb347' }
    });

    Matter.World.add(this.engine.world, [ground, ball]);
    
    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, this.engine);
    Matter.Render.run(this.render);
  }
"""

    fe_app_ts = f"""{physics_imports}
import {{ RouterOutlet }} from '@angular/router';


@Component({{
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.{style_ext}'
}})
export class App {{
  protected readonly title = signal('{project_name}');
  {physics_logic}
}}
"""

    # Template logic (Tailwind vs Bulma vs Plain)
    card_classes = "box" if css_choice == "bulma" else "p-8 bg-white rounded-xl shadow-2xl border border-gray-100"
    btn_classes = "button is-primary" if css_choice == "bulma" else "px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
    container_classes = "container" if css_choice == "bulma" else "max-w-4xl mx-auto p-4 flex items-center justify-center min-h-screen"
    scene_classes = "mt-4 border rounded-lg bg-gray-50 h-[220px]" if css_choice == "tailwind" else "scene mt-4"

    fe_app_html = f"""<main class="{container_classes}">
  <div #card class="{card_classes} text-center">
    <p class="text-xs uppercase tracking-widest text-gray-500 mb-2">Portfolio Project</p>
    <h1 class="text-4xl font-bold mb-4 font-inter">Welcome to {project_name}</h1>
    <p class="text-gray-600 mb-6">Built with Angular v21, Node/Express, and MongoDB.</p>
    
    <div class="flex gap-4 justify-center">
      <button class="{btn_classes}" (click)="celebrate()">
        Celebrate
      </button>
    </div>

    <div #scene class="{scene_classes}">
      <!-- Physics Scene -->
    </div>
  </div>

  <router-outlet></router-outlet>
</main>
"""

    fe_index_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{project_name}</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
  { '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@1.0.1/css/bulma.min.css">' if css_choice == 'bulma' else '' }
</head>
<body class="bg-slate-50">
  <app-root></app-root>
</body>
</html>
"""

    # --- Write Backend ---
    (backend_root / "package.json").write_text(json.dumps(be_package_json, indent=2), encoding='utf-8')
    (backend_root / "app.js").write_text(be_app_js, encoding='utf-8')
    (backend_root / "bin").mkdir()
    (backend_root / "bin" / "www").write_text(be_www, encoding='utf-8')
    (backend_root / "routes").mkdir()
    (backend_root / "routes" / "index.js").write_text(be_routes_index, encoding='utf-8')
    (backend_root / "models").mkdir()
    
    if fe_hosting == "vercel":
        fe_vercel_json = {
            "rewrites": [
                { "source": "/(.*)", "destination": "/index.html" }
            ]
        }
        (frontend_root / "vercel.json").write_text(json.dumps(fe_vercel_json, indent=2), encoding='utf-8')

        vercel_config = {
            "headers": [
                {
                    "source": "/(.*)",
                    "headers": [
                        { "key": "X-Frame-Options", "value": "ALLOWALL" },
                        { 
                            "key": "Content-Security-Policy", 
                            "value": "frame-ancestors 'self' https://carter-portfolio.fyi https://carter-portfolio.vercel.app https://*.vercel.app http://localhost:3000" 
                        }
                    ]
                }
            ]
        }
        (backend_root / "vercel.json").write_text(json.dumps(vercel_config, indent=2), encoding='utf-8')

    # --- Write Frontend ---
    (frontend_root / "package.json").write_text(json.dumps(fe_package_json, indent=2), encoding='utf-8')
    (frontend_root / "angular.json").write_text(json.dumps(fe_angular_json, indent=2), encoding='utf-8')
    # --- Write Frontend Configs ---
    (frontend_root / "package.json").write_text(json.dumps(fe_package_json, indent=2), encoding='utf-8')
    (frontend_root / "angular.json").write_text(json.dumps(fe_angular_json, indent=2), encoding='utf-8')
    (frontend_root / "tsconfig.json").write_text(json.dumps(fe_tsconfig_json, indent=2), encoding='utf-8')
    (frontend_root / "tsconfig.app.json").write_text(json.dumps({
        "extends": "./tsconfig.json",
        "compilerOptions": { "outDir": "./out-tsc/app", "types": [] },
        "include": ["src/**/*.ts"]
    }, indent=2), encoding='utf-8')
    (frontend_root / ".prettierrc").write_text(fe_prettierrc, encoding='utf-8')
    (frontend_root / ".editorconfig").write_text(fe_editorconfig, encoding='utf-8')
    
    vscode_dir = frontend_root / ".vscode"
    vscode_dir.mkdir()
    (vscode_dir / "extensions.json").write_text(json.dumps(fe_vscode_extensions, indent=2), encoding='utf-8')

    if css_choice == "tailwind":
        (frontend_root / "tailwind.config.js").write_text(fe_tailwind_config, encoding='utf-8')
        (frontend_root / "postcss.config.js").write_text(fe_postcss_config, encoding='utf-8')
    
    (frontend_root / "public").mkdir()
    src_root = frontend_root / "src"
    src_root.mkdir()
    (src_root / "index.html").write_text(fe_index_html, encoding='utf-8')
    
    # Styles
    styles_content = "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n" if css_choice == "tailwind" else "/* Global Styles */\n"
    (src_root / f"styles.{style_ext}").write_text(styles_content, encoding='utf-8')
    (src_root / "main.ts").write_text(fe_main_ts, encoding='utf-8')
    
    app_dir = src_root / "app"
    app_dir.mkdir()
    (app_dir / "app.ts").write_text(fe_app_ts, encoding='utf-8')
    (app_dir / "app.html").write_text(fe_app_html, encoding='utf-8')
    (app_dir / f"app.{style_ext}").write_text("/* App Styles */\n", encoding='utf-8')
    (app_dir / "app.config.ts").write_text(fe_app_config_ts, encoding='utf-8')
    (app_dir / "app.routes.ts").write_text(fe_app_routes_ts, encoding='utf-8')

    # --- Env File (Root Only) ---
    env_content = f"""PROJECT_NAME={project_name}
PORT={be_port}
FRONTEND_PORT={fe_port}
MONGODB_URI=mongodb://localhost:27017/{project_name}

# Production Settings
PRODUCTION=false
PROD_FRONTEND_URL=
PROD_BACKEND_URL=
"""
    (project_root / ".env").write_text(env_content, encoding='utf-8')

    # --- Root Files ---
    (project_root / ".gitignore").write_text("node_modules/\ndist/\n.env\n.angular/\n.vscode/\n", encoding='utf-8')
    (project_root / "README.md").write_text(fe_readme, encoding='utf-8')

    # AI Config
    ai_rules_common = f"""## Agent Operational Directives
- **File Deletions**: When deleting multiple files, do so one at a time.
- **Syntax**: Always use standard Windows PowerShell syntax (e.g., `Remove-Item`, `New-Item`).
- **Persistence**: If a command fails, try alternative PowerShell methods before giving up.
- **Privacy**: Never expose the `.env` file content in logs.
"""

    if ai_choice == "Agents.md":
        (project_root / "AGENTS.md").write_text(f"""# {project_name} - Agent Instructions

This project follows a decoupled MEAN stack architecture.

## Architecture
- **Frontend**: Angular v21+ (located in `/frontend`)
- **Backend**: Node/Express + Mongoose (located in `/backend`)

## Portfolio Requirements
- **Security**: Iframe headers are set to allow embedding in `carter-portfolio.fyi`.
- **CSS**: Using {css_choice}.
- **Features**: {", ".join([f for f, v in [("Physics (Matter)", use_matter), ("Animations (Anime)", use_anime), ("Confetti", use_confetti)] if v]) or "Standard"}.

## Agent Rules
- Always maintain the iframe security headers in `backend/app.js`.
- Prefer Signals for Angular state.
- Use standalone components.

{ai_rules_common}
""", encoding='utf-8')
    elif ai_choice == "Cursor":
        (project_root / ".cursorrules").write_text(f"# {project_name} Cursor Rules\n\n- Angular 21 (Signals, standalone).\n- Maintain iframe CSP headers in backend/app.js.\n\n{ai_rules_common}\n", encoding='utf-8')
    elif ai_choice == "Claude":
        claude_dir = project_root / ".claudecode"
        claude_dir.mkdir()
        (claude_dir / "memory.md").write_text(f"""# Project Memory: {project_name}

## Summary
Decoupled MEAN Stack (Angular {fe_port} / Express {be_port}).

## Tech Stack
- Frontend: Angular v21, Matter-js, Animejs.
- Backend: Express, Mongoose, Helmet.

## Directives
{ai_rules_common}
""", encoding='utf-8')

    # --- Git Init ---
    try:
        subprocess.run(["git", "init"], cwd=project_root, check=True, capture_output=True)
        print("Initialized Git repository.")
    except Exception as e:
        print(f"Warning: Could not initialize Git: {e}")

    # --- NPM Install ---
    print("\nInstalling dependencies (this may take a few minutes)...")
    try:
        print(f"[{project_name}] Backend npm install...")
        subprocess.run(["npm", "install"], cwd=backend_root, check=True, shell=True)
        print(f"[{project_name}] Frontend npm install...")
        subprocess.run(["npm", "install"], cwd=frontend_root, check=True, shell=True)
        print("Success: Dependencies installed successfully.")
    except Exception as e:
        print(f"Warning: npm install failed: {e}")

    print("\nProject creation complete!")
    print(f"Location: {project_root}")
    print("\nNext steps:")
    print(f"  cd {project_name}/backend && npm start")
    print(f"  cd {project_name}/frontend && npm start")

if __name__ == "__main__":
    main()
