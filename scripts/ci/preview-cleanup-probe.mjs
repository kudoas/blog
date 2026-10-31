import { spawnSync } from 'node:child_process';

const name = process.env.PROBE_PREVIEW_NAME;
if (!/^cleanup-probe-pr-\d+$/.test(name ?? '')) throw new Error('Only this PR probe Preview can be deleted');
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!account || !token) throw new Error('Missing Cloudflare credentials');
const base = `https://api.cloudflare.com/client/v4/accounts/${account}/workers/workers`;
async function request(label, method, path) {
  const response = await fetch(`${base}/${path}`, { method, headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  console.log(JSON.stringify({ label, status: response.status, success: data.success, errors: data.errors?.map(({ code, message }) => ({ code, message })) }));
  return { response, data };
}
const worker = await request('worker by name', 'GET', 'tech-blog');
const preview = await request('preview by name', 'GET', `tech-blog/previews/${name}`);
const result = spawnSync('bun', ['x', 'cf', 'previews', 'delete', name, '--worker', 'tech-blog', '--force'], { stdio: 'inherit' });
console.log(JSON.stringify({ label: 'cf delete by name', exitCode: result.status }));
if (result.status !== 0) {
  const direct = await request('direct delete by name', 'DELETE', `tech-blog/previews/${name}`);
  if (!direct.response.ok && preview.data.result?.id) {
    const byPreviewId = await request('delete by preview ID', 'DELETE', `tech-blog/previews/${preview.data.result.id}`);
    if (!byPreviewId.response.ok && worker.data.result?.id) await request('delete by worker and preview IDs', 'DELETE', `${worker.data.result.id}/previews/${preview.data.result.id}`);
  }
}
await request('confirm preview absent', 'GET', `tech-blog/previews/${name}`);
