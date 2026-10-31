import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const [id, taskFile] = process.argv.slice(2);
if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id ?? '') || !taskFile) {
  console.error('Usage: blog-agent TASK_ID TASK_FILE (id: lowercase letters, digits, hyphens)');
  process.exit(2);
}
if (!fs.existsSync('/etc/blog-devcontainer')) {
  throw new Error('Run blog-agent inside the blog Dev Container.');
}
const task = fs.readFileSync(path.resolve(taskFile), 'utf8');
const root = process.env.BLOG_AGENT_ROOT ?? '/workspaces/blog';
const stateRoot = process.env.BLOG_AGENT_STATE;
if (!stateRoot) throw new Error('BLOG_AGENT_STATE is required.');
const state = path.join(stateRoot, id);
const worktree = path.join(state, 'worktree');
const branch = `agent/${id}`;
fs.mkdirSync(state, { recursive: true });
const lock = path.join(stateRoot, 'active.lock');
// An OS-level flock releases automatically even after a crash; the child owns it.
if (!process.env.BLOG_AGENT_LOCKED) {
  const child = spawn('flock', ['--nonblock', '--no-fork', lock, process.execPath, ...process.argv.slice(1)], {
    stdio: 'inherit', env: { ...process.env, BLOG_AGENT_LOCKED: '1' },
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('error', (error) => { console.error(error); process.exitCode = 1; });
  child.on('exit', (code) => { process.exitCode = code ?? 1; });
} else {
  await run();
}

async function run() {
  const maxAttempts = Number(process.env.BLOG_AGENT_MAX_ATTEMPTS ?? 3);
  const timeoutSeconds = Number(process.env.BLOG_AGENT_TIMEOUT_SECONDS ?? 7200);
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || !Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    throw new Error('Invalid attempt/time limit.');
  }
  const deadline = Date.now() + timeoutSeconds * 1000;
  const runDir = path.join(state, new Date().toISOString().replaceAll(':', '-'));
  fs.mkdirSync(runDir);
  const resultFile = path.join(runDir, 'result.json');
  const taskPath = path.join(state, 'task.md');
  let pr;
  let sha;
  let activeChild;
  const stop = () => { if (activeChild?.pid) { try { process.kill(-activeChild.pid, 'SIGKILL'); } catch {} } };
  process.on('SIGTERM', () => { stop(); process.exit(143); });
  process.on('SIGINT', () => { stop(); process.exit(130); });

  async function command(bin, args, { cwd = worktree, input, log, allowFailure = false } = {}) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('Task time limit reached.');
    const stream = log ? fs.createWriteStream(path.join(runDir, log), { flags: 'a' }) : null;
    const child = spawn(bin, args, { cwd, detached: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GH_PROMPT_DISABLED: '1', SSH_AUTH_SOCK: '' }, stdio: ['pipe', 'pipe', 'pipe'] });
    activeChild = child;
    const timer = setTimeout(stop, remaining);
    let stdout = '';
    const stderr = log ? fs.createWriteStream(path.join(runDir, `${log}.stderr`), { flags: 'a' }) : null;
    child.stdout.on('data', (chunk) => { if (stream) stream.write(chunk); else stdout += chunk; });
    child.stderr.on('data', (chunk) => { if (stderr) stderr.write(chunk); else process.stderr.write(chunk); });
    child.stdin.on('error', (error) => { if (error.code !== 'EPIPE') console.error(error); });
    child.stdin.end(input);
    try {
      const code = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (code) => resolve(code ?? 1));
      });
      if (code !== 0 && !allowFailure) throw new Error(`${bin} ${args[0]} failed (${code}); see ${log ?? 'stderr'}`);
      return { code, stdout: stdout.trim() };
    } finally {
      clearTimeout(timer);
      activeChild = undefined;
      if (stream) await new Promise((resolve) => stream.end(resolve));
      if (stderr) await new Promise((resolve) => stderr.end(resolve));
    }
  }
  const git = async (...args) => (await command('git', args)).stdout;
  const clean = async () => !(await git('status', '--porcelain'));
  const writeResult = (status, detail) => fs.writeFileSync(resultFile, JSON.stringify({ status, detail, branch, sha, pr, worktree, logs: runDir }, null, 2));
  try {
    if (fs.existsSync(taskPath) && fs.readFileSync(taskPath, 'utf8') !== task) throw new Error('Task ID already belongs to a different prompt. Use a new ID.');
    fs.writeFileSync(taskPath, task);
    await command('codex', ['login', 'status'], { cwd: root });
    await command('gh', ['auth', 'status', '--hostname', 'github.com'], { cwd: root });
    await command('git', ['config', '--get', 'user.name'], { cwd: root });
    await command('git', ['config', '--get', 'user.email'], { cwd: root });
    await command('gh', ['auth', 'setup-git', '--hostname', 'github.com'], { cwd: root });
    await command('git', ['fetch', 'origin', 'main'], { cwd: root });
    if (!fs.existsSync(worktree)) {
      await command('git', ['worktree', 'add', '-b', branch, worktree, 'origin/main'], { cwd: root });
    }
    if (await git('branch', '--show-current') !== branch) throw new Error('Unexpected worktree branch.');
    const repo = (await command('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'])).stdout;
    if (repo !== 'kudoas/blog') throw new Error(`Unexpected repository: ${repo}`);
    let feedback = '';
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`Attempt ${attempt}/${maxAttempts}: ${worktree}`);
      const agentFile = path.join(runDir, `agent-${attempt}.json`);
      const prompt = `Implement the following task in this existing worktree. Use this branch only: ${branch}.
Do not create another worktree, push, create a PR, merge, or deploy; the controller performs publication after verification.
Do not commit: leave the intended changes for the controller. Preserve existing work on resume.
Run useful checks, then report status=ready or blocked. Answer title and summary in Japanese.
The summary will be the PR body: explain the problem, final changes, validation, and limitations.
Task:\n${task}\n\nFeedback from the previous attempt:\n${feedback || 'None.'}`;
      const agent = await command('codex', ['-a', 'never', '--sandbox', 'danger-full-access', 'exec', '--json', '--output-schema', path.join(toolDir, 'result.schema.json'), '-o', agentFile, '-'], { input: prompt, log: `agent-${attempt}.jsonl`, allowFailure: true });
      if (agent.code !== 0) throw new Error(`Codex failed; see agent-${attempt}.jsonl`);
      const report = JSON.parse(fs.readFileSync(agentFile, 'utf8'));
      if (report.status !== 'ready') throw new Error(`Codex blocked: ${report.summary}`);
      if (await git('branch', '--show-current') !== branch) throw new Error('Codex changed branch.');
      if (!report.title?.trim() || !report.summary?.trim() || !Array.isArray(report.limitations)) throw new Error('Invalid Codex report.');
      const verification = await command('bash', [path.join(toolDir, 'verify.sh')], { log: `verify-${attempt}.log`, allowFailure: true });
      if (verification.code !== 0) {
        feedback = `Verification failed. Read ${path.join(runDir, `verify-${attempt}.log`)} and its .stderr file and fix the cause.`;
        continue;
      }
      if (!(await clean())) {
        await git('add', '--all');
        await git('commit', '-m', report.title);
      }
      sha = await git('rev-parse', 'HEAD');
      if (await git('rev-list', '--count', 'origin/main..HEAD') === '0') throw new Error('No task changes to publish.');
      const existing = JSON.parse((await command('gh', ['pr', 'list', '--repo', repo, '--head', branch, '--state', 'all', '--json', 'url,state'])).stdout);
      if (existing.some((p) => p.state !== 'OPEN')) throw new Error('This task already has a closed/merged PR; use a new task ID.');
      // Publication always uses the tested SHA; never push main or force-push.
      await git('push', '--set-upstream', 'origin', `HEAD:refs/heads/${branch}`);
      const body = path.join(runDir, 'pr.md');
      fs.writeFileSync(body, `${report.summary}\n\n検証: verify・Chromium E2E・Cloudflare dry-run 成功。\n対象コミット: ${sha}\nGitHub Actions の結果は PR のチェックを参照してください。\n${report.limitations.map((x) => `\n- ${x}`).join('')}\n`);
      if (existing.length) {
        pr = existing[0].url;
        await command('gh', ['pr', 'edit', pr, '--title', report.title, '--body-file', body]);
      } else {
        pr = (await command('gh', ['pr', 'create', '--repo', repo, '--base', 'main', '--head', branch, '--title', report.title, '--body-file', body])).stdout;
      }
      // CI may not have been registered immediately after PR creation.
      let checks;
      while (true) {
        const remoteSha = (await command('gh', ['pr', 'view', pr, '--json', 'headRefOid', '--jq', '.headRefOid'])).stdout;
        if (remoteSha !== sha) throw new Error('PR head changed during CI; refusing to claim this SHA passed.');
        checks = await command('gh', ['pr', 'checks', pr, '--json', 'name,bucket,link'], { allowFailure: true });
        if (!checks.stdout.startsWith('[')) throw new Error('Cannot read PR checks.');
        const rows = JSON.parse(checks.stdout);
        const ci = rows.filter((r) => r.name === 'ci');
        if (ci.length && ci.every((r) => r.bucket === 'pass') && rows.every((r) => ['pass', 'skipping'].includes(r.bucket))) break;
        if (rows.some((r) => ['fail', 'cancel'].includes(r.bucket))) break;
        if (Date.now() + 10000 >= deadline) throw new Error('CI wait time limit reached.');
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
      fs.writeFileSync(path.join(runDir, `ci-${attempt}.json`), checks.stdout);
      const rows = JSON.parse(checks.stdout);
      if (rows.some((r) => ['fail', 'cancel'].includes(r.bucket))) {
        feedback = `PR CI failed. Use gh run view / gh run view --log-failed to inspect and fix these checks:\n${checks.stdout}`;
        continue;
      }
      if ((await command('gh', ['pr', 'view', pr, '--json', 'headRefOid', '--jq', '.headRefOid'])).stdout !== sha) throw new Error('PR head changed after CI.');
      if (await git('rev-parse', 'HEAD') !== sha || !(await clean())) throw new Error('Worktree changed after verification.');
      writeResult('complete', 'Local verification and PR CI passed. No merge performed.');
      console.log(`Complete: ${pr}\n${resultFile}`);
      return;
    }
    throw new Error(`Attempt limit reached. ${feedback}`);
  } catch (error) {
    writeResult('failed', error.message);
    console.error(`${error.message}\n${resultFile}`);
    process.exitCode = 1;
  }
}
