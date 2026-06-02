const { spawn } = require('child_process');
const proc = spawn('cloudflared', [
  'tunnel',
  '--config', 'C:\\Users\\RAJKUMAR\\.cloudflared\\config.yml',
  'run'
], { stdio: 'inherit', shell: true });

proc.on('exit', (code) => {
  console.log('cloudflared exited with code', code, '- PM2 will restart');
  process.exit(code || 1);
});
