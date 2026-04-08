# Code-Pract - Agent Instructions

This project follows a decoupled MEAN stack architecture.

## Architecture
- **Frontend**: Angular v21+ (located in `/frontend`)
- **Backend**: Node/Express + Mongoose (located in `/backend`)

## Portfolio Requirements
- **Security**: Iframe headers are set to allow embedding in `carter-portfolio.fyi`.
- **CSS**: Using tailwind.
- **Features**: Physics (Matter), Animations (Anime), Confetti.

## Agent Rules
- Always maintain the iframe security headers in `backend/app.js`.
- Prefer Signals for Angular state.
- Use standalone components.

## Agent Operational Directives
- **File Deletions**: When deleting multiple files, do so one at a time.
- **Syntax**: Always use standard Windows PowerShell syntax (e.g., `Remove-Item`, `New-Item`).
- **Persistence**: If a command fails, try alternative PowerShell methods before giving up.
- **Privacy**: Never expose the `.env` file content in logs.

