#!/usr/bin/env node

/**
 * AIWai News Portal - Git Deploy Script
 * Handles committing and pushing changes to GitHub
 *
 * Usage:
 *   npm run deploy
 *   node deploy.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, prefix, message) {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

function error(message) {
  log(colors.red, '❌', message);
}

function success(message) {
  log(colors.green, '✅', message);
}

function info(message) {
  log(colors.blue, 'ℹ️ ', message);
}

function warn(message) {
  log(colors.yellow, '⚠️ ', message);
}

async function deploy() {
  try {
    info('Starting deployment...\n');

    // 1. Clean up git lock file
    const lockFile = '.git/index.lock';
    if (fs.existsSync(lockFile)) {
      try {
        fs.unlinkSync(lockFile);
        success('Removed stale git lock file');
      } catch (e) {
        warn(`Could not remove git lock (${e.message}), continuing anyway...`);
      }
    }

    // 2. Check git status
    info('Checking git status...');
    try {
      const status = execSync('git status --short', { encoding: 'utf8' });
      if (!status) {
        warn('No changes to commit');
        return;
      }
    } catch (e) {
      error(`Git error: ${e.message}`);
      process.exit(1);
    }

    // 3. Configure git if needed
    try {
      const email = execSync('git config user.email', { encoding: 'utf8' }).trim();
      const name = execSync('git config user.name', { encoding: 'utf8' }).trim();
      if (!email || !name) throw new Error('Missing config');
      success(`Git configured as: ${name} <${email}>`);
    } catch (e) {
      info('Configuring git user...');
      try {
        execSync('git config user.email "marek6296@gmail.com"', { stdio: 'inherit' });
        execSync('git config user.name "Marek"', { stdio: 'inherit' });
        success('Git user configured');
      } catch (configError) {
        error(`Could not configure git: ${configError.message}`);
        process.exit(1);
      }
    }

    // 4. Stage changes (only specific paths to avoid unwanted commits)
    info('Staging changes...');
    const filesToStage = [
      'src/app/admin/page.tsx',
      'src/app/api/admin/gemini-topics/',
    ];

    for (const file of filesToStage) {
      try {
        execSync(`git add "${file}"`, { stdio: 'pipe' });
        success(`Staged: ${file}`);
      } catch (e) {
        warn(`Could not stage ${file}: ${e.message}`);
      }
    }

    // 5. Check if there's anything staged
    try {
      const staged = execSync('git diff --cached --name-only', { encoding: 'utf8' }).trim();
      if (!staged) {
        warn('No files staged for commit');
        return;
      }
      info(`Staged files:\n${staged.split('\n').map(f => `  - ${f}`).join('\n')}`);
    } catch (e) {
      error(`Failed to check staged files: ${e.message}`);
      process.exit(1);
    }

    // 6. Create commit
    info('Creating commit...');
    const commitMessage = `feat(discovery): add Gemini Live Search with Google integration

- Add Gemini 2.0 Flash with live Google Search grounding
- Create new /api/admin/gemini-topics endpoint
- Add Discovery tab model switcher: Gemini Live vs GPT-4o + RSS
- Support custom query/topic focus for Gemini searches
- Improve Discovery UI with tabbed settings for each model
- Uses GEMINI_API_KEY from .env for both image generation and live search`;

    try {
      execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
      success('Commit created');
    } catch (e) {
      if (e.message.includes('nothing to commit')) {
        warn('Nothing to commit (working tree clean)');
        return;
      }
      error(`Commit failed: ${e.message}`);
      process.exit(1);
    }

    // 7. Push to GitHub
    info('Pushing to GitHub...');
    try {
      execSync('git push origin main', { stdio: 'inherit' });
      success('Pushed to GitHub!');
    } catch (e) {
      if (e.message.includes('401') || e.message.includes('403')) {
        error('Authentication failed. Please authenticate with GitHub:');
        info('Run: gh auth login');
        info('Then try again: npm run deploy');
        process.exit(1);
      }
      error(`Push failed: ${e.message}`);
      process.exit(1);
    }

    console.log(`\n${colors.green}${'═'.repeat(50)}${colors.reset}`);
    success('Deployment completed successfully! 🎉');
    console.log(`${colors.green}${'═'.repeat(50)}${colors.reset}\n`);

  } catch (e) {
    error(`Unexpected error: ${e.message}`);
    process.exit(1);
  }
}

// Check if git is available
try {
  execSync('git --version', { stdio: 'pipe' });
} catch (e) {
  error('Git is not installed. Please install git first.');
  process.exit(1);
}

deploy().catch(e => {
  error(`Fatal error: ${e.message}`);
  process.exit(1);
});
