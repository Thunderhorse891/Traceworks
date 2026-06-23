import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const vaultDir = resolve(repoRoot, 'vaults', 'claude-obsidian');
const obsidianDir = resolve(vaultDir, '.obsidian');
const skillsDir = resolve(vaultDir, 'claude-skills');
const sourceRepo = 'https://github.com/alirezarezvani/claude-skills.git';

function ensureDir(pathname) {
  mkdirSync(pathname, { recursive: true });
}

function writeIfChanged(pathname, content) {
  const current = existsSync(pathname) ? readFileSync(pathname, 'utf8') : null;
  if (current !== content) {
    writeFileSync(pathname, content, 'utf8');
  }
}

function syncSkillsRepo() {
  try {
    if (!existsSync(skillsDir)) {
      execSync(`git clone ${sourceRepo} "${skillsDir}"`, { stdio: 'pipe' });
      return { status: 'cloned' };
    }

    execSync('git pull --ff-only', { cwd: skillsDir, stdio: 'pipe' });
    return { status: 'updated' };
  } catch (error) {
    return {
      status: 'unavailable',
      message: error?.stderr?.toString?.().trim() || error?.message || 'Unknown git error'
    };
  }
}

ensureDir(obsidianDir);
ensureDir(vaultDir);

const workspaceJson = {
  active: 'claude-skills',
  source: sourceRepo,
  lastAppliedBy: 'scripts/setup-claude-obsidian-vault.mjs'
};

writeIfChanged(
  resolve(obsidianDir, 'workspace.json'),
  `${JSON.stringify(workspaceJson, null, 2)}\n`
);

const syncResult = syncSkillsRepo();

const vaultNote = `# Claude Obsidian Vault\n\nThis vault is prepared for Claude skills from **alirezarezvani/claude-skills**.\n\n- Source repo: ${sourceRepo}\n- Local path: ./claude-skills\n- Sync status: ${syncResult.status}\n${syncResult.message ? `- Sync message: ${syncResult.message}\n` : ''}\n## Apply this vault when needed\n\n1. Open Obsidian and choose the vault folder: \`vaults/claude-obsidian\`.\n2. Use notes and skills from \`claude-skills\`.\n3. Re-run the setup script to refresh from GitHub:\n\n\`\`\`bash\nnpm run vault:claude\n\`\`\`\n`;

writeIfChanged(resolve(vaultDir, 'README.md'), vaultNote);

console.log(`Vault ready at: ${vaultDir}`);
if (syncResult.status === 'unavailable') {
  console.warn('Vault created, but remote sync is currently unavailable.');
  console.warn(syncResult.message);
} else {
  console.log(`Skills repo ${syncResult.status}.`);
}
