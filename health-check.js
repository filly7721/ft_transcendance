const { execSync } = require('child_process');

console.log('Checking bridge health...');
let healthy = false;
while (!healthy) {
    try {
        execSync('node C:\\Users\\loq\\Documents\\sandbox_bridge\\sandbox-bridge-cli.js health', { stdio: 'ignore' });
        healthy = true;
        console.log('Bridge is healthy.');
    } catch (e) {
        console.log('Bridge not ready, retrying in 2 seconds...');
        execSync('powershell -Command "Start-Sleep -Seconds 2"');
    }
}
