import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';

const runner = fileURLToPath(new URL('../../scripts/agent/run.mjs', import.meta.url));
const inside = fs.existsSync('/etc/blog-devcontainer');
const fake = `#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const bin = path.basename(process.argv[1]), args = process.argv.slice(2);
const env = process.env;
const event = (data) => fs.appendFileSync(env.FAKE_EVENTS, JSON.stringify(data) + '\\n');
const sha = () => cp.execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
if (bin === 'codex') {
  if (args[0] === 'login') process.exit(env.FAKE_MODE === 'auth' ? 1 : 0);
  event({action:'implement'});
  if (env.FAKE_MODE === 'timeout') { setInterval(() => {}, 1000); return; }
  fs.writeFileSync('change.txt', 'implemented\\n');
  const out = args[args.indexOf('-o') + 1];
  fs.writeFileSync(out, JSON.stringify({status: env.FAKE_MODE === 'blocked' ? 'blocked' : 'ready', title:'fix: test task', summary:'Test change', limitations:[]}));
  console.log(JSON.stringify({type:'test-event'}));
} else if (bin === 'bun') {
  event({action:'verify', args});
  if (args[0] === '--version') console.log(JSON.parse(fs.readFileSync('package.json')).packageManager.slice(4));
  else if (args.join(' ') === 'run verify') {
    if (env.FAKE_MODE === 'verify-fail') process.exit(1);
    if (env.FAKE_MODE === 'repair' && !fs.existsSync(env.FAKE_PR + '.repaired')) {
      fs.writeFileSync(env.FAKE_PR + '.repaired', 'first attempt failed'); process.exit(1);
    }
  }
} else if (bin === 'gh') {
  if (args[0] === 'repo') console.log('kudoas/blog');
  if (args[0] !== 'pr') return;
  if (args[1] === 'list') console.log(fs.existsSync(env.FAKE_PR) ? JSON.stringify([{url:'https://github.com/kudoas/blog/pull/999',state: env.FAKE_MODE === 'closed' ? 'CLOSED' : 'OPEN'}]) : '[]');
  if (args[1] === 'create') { event({action:'create-pr'}); fs.writeFileSync(env.FAKE_PR, 'open'); console.log('https://github.com/kudoas/blog/pull/999'); }
  if (args[1] === 'view') console.log(env.FAKE_MODE === 'head-changed' ? 'different-sha' : sha());
  if (args[1] === 'checks') console.log(JSON.stringify([{name:'ci',bucket:env.FAKE_MODE === 'ci-fail' ? 'fail' : 'pass',link:'https://example.com/run'}]));
}
`;
function fixture(t, mode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-agent-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const root = path.join(dir, 'repo'), remote = path.join(dir, 'origin.git'), state = path.join(dir, 'state'), bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  for (const name of ['gh', 'codex', 'bun']) fs.writeFileSync(path.join(bin, name), fake, {mode:0o755});
  const git = (cwd, ...args) => execFileSync('git', args, {cwd, encoding:'utf8', stdio:['ignore','pipe','pipe']}).trim();
  git(dir, 'init', '--bare', remote);
  git(dir, 'init', '-b', 'main', root);
  git(root, 'config', 'user.name', 'Agent Test');
  git(root, 'config', 'user.email', 'agent-test@example.invalid');
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({engines:{node:process.version.slice(1)},packageManager:'bun@1.4.4'}));
  git(root, 'add', '.'); git(root, 'commit', '-m', 'initial');
  git(root, 'remote', 'add', 'origin', remote); git(root, 'push', 'origin', 'main');
  const task = path.join(dir, 'task.md'); fs.writeFileSync(task, 'Implement change.txt');
  const env = { ...process.env, PATH:`${bin}:${process.env.PATH}`, BLOG_AGENT_ROOT:root, BLOG_AGENT_STATE:state, BLOG_AGENT_MAX_ATTEMPTS:'1', BLOG_AGENT_TIMEOUT_SECONDS:mode === 'timeout' ? '2' : '30', FAKE_MODE:mode, FAKE_EVENTS:path.join(dir, 'events'), FAKE_PR:path.join(dir,'pr') };
  delete env.BLOG_AGENT_LOCKED;
  const execute = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [runner, 'test-task', task], {cwd:root, env});
    let output = '';
    child.stdout.on('data', x => output += x); child.stderr.on('data', x => output += x);
    child.on('error', reject); child.on('exit', code => resolve({code, output}));
  });
  const events = () => fs.existsSync(env.FAKE_EVENTS) ? fs.readFileSync(env.FAKE_EVENTS,'utf8').trim().split('\n').map(JSON.parse) : [];
  const results = () => fs.readdirSync(path.join(state,'test-task')).filter(n=> n !== 'worktree' && n !== 'task.md').sort().map(n=>JSON.parse(fs.readFileSync(path.join(state,'test-task',n,'result.json'),'utf8')));
  return {execute, events, results, git, remote, env, task};
}

for (const mode of ['verify-fail', 'auth', 'blocked', 'timeout']) {
  test(`${mode} stops before push and PR creation`, { skip: !inside }, async t => {
    const f = fixture(t, mode), result = await f.execute();
    assert.notEqual(result.code, 0, result.output);
    assert.equal(f.events().some(e => e.action === 'create-pr'), false);
    assert.equal(f.git(f.remote, 'branch', '--list', 'agent/*'), '');
    assert.equal(f.results().at(-1).status, 'failed');
  });
}
test('publishes tested SHA, waits for CI, and reuses the PR on rerun', { skip: !inside }, async t => {
  const f = fixture(t, 'ok');
  let result = await f.execute(); assert.equal(result.code, 0, result.output);
  const first = f.results().at(-1);
  assert.equal(first.status, 'complete');
  assert.equal(f.git(f.remote, 'rev-parse', 'agent/test-task'), first.sha);
  result = await f.execute(); assert.equal(result.code, 0, result.output);
  assert.equal(f.events().filter(e=>e.action==='create-pr').length, 1);
  fs.appendFileSync(f.task, 'Different instruction');
  result = await f.execute(); assert.notEqual(result.code, 0); assert.match(result.output, /different prompt/);
});
test('changed PR head never reports success', { skip: !inside }, async t => {
  const f = fixture(t, 'head-changed'), result = await f.execute();
  assert.notEqual(result.code, 0); assert.match(result.output, /head changed/);
  assert.equal(f.results().at(-1).status, 'failed');
});
test('failed CI retains PR and reports failure at attempt limit', { skip: !inside }, async t => {
  const f = fixture(t, 'ci-fail'), result = await f.execute();
  assert.notEqual(result.code, 0); assert.match(result.output, /Attempt limit/);
  assert.equal(f.results().at(-1).pr, 'https://github.com/kudoas/blog/pull/999');
});
test('closed PR is not pushed again', { skip: !inside }, async t => {
  const f = fixture(t, 'closed'); fs.writeFileSync(f.env.FAKE_PR, 'closed');
  const result = await f.execute(); assert.notEqual(result.code, 0); assert.match(result.output, /closed\/merged PR/);
  assert.equal(f.git(f.remote, 'branch', '--list', 'agent/*'), '');
});

test('failed verification is repaired before publishing', { skip: !inside }, async t => {
  const f = fixture(t, 'repair'); f.env.BLOG_AGENT_MAX_ATTEMPTS = '2';
  const result = await f.execute(); assert.equal(result.code, 0, result.output);
  const events = f.events();
  assert.equal(events.filter(e => e.action === 'implement').length, 2);
  assert.equal(events.filter(e => e.action === 'create-pr').length, 1);
  assert.equal(f.results().at(-1).status, 'complete');
});
test('concurrent invocation is rejected and lock is released after timeout', { skip: !inside }, async t => {
  const f = fixture(t, 'timeout');
  const first = f.execute();
  while (!f.events().some(e => e.action === 'implement')) await new Promise(r => setTimeout(r, 20));
  const second = await f.execute(); assert.notEqual(second.code, 0);
  await first;
  f.env.FAKE_MODE = 'ok'; f.env.BLOG_AGENT_TIMEOUT_SECONDS = '30';
  const resumed = await f.execute(); assert.equal(resumed.code, 0, resumed.output);
});
