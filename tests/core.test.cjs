'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../lib/core.cjs');

test('only real HTTPS ChatGPT and official authentication origins stay inside the app', () => {
  assert.equal(core.chatURL('https://chatgpt.com/c/123'), true);
  assert.equal(core.internalURL('https://accounts.google.com/o/oauth2/auth'), true);
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'http://chatgpt.com/', 'https://chatgpt.com.evil.test/', 'https://chatgpt.com@evil.test/', 'https://evil.test@chatgpt.com/']) {
    assert.equal(core.internalURL(url), false, url);
  }
  assert.equal(core.httpsURL('not a url'), null);
});
test('stored settings never escalate filesystem access or restore an arbitrary web origin', () => {
  const settings = core.normalizeSettings({ sandbox: 'danger-full-access', chatURL: 'https://evil.test/', workspace: 'relative', autostart: 'true' }, '/tmp/home');
  assert.equal(settings.sandbox, 'read-only');
  assert.equal(settings.chatURL, core.CHAT_URL);
  assert.equal(settings.workspace, '/tmp/home/DavaDesk-work');
  assert.equal(settings.autostart, false);
});
test('dock and panel stay on their selected monitor, including narrow screens', () => {
  for (const area of [ {x:0,y:36,width:1920,height:1044}, {x:-1280,y:0,width:1280,height:720}, {x:50,y:70,width:480,height:320} ]) {
    for (const expanded of [true, false]) {
      const bounds = core.windowBounds(area, expanded);
      assert(bounds.x >= area.x); assert(bounds.y >= area.y);
      assert(bounds.x + bounds.width <= area.x + area.width);
      assert(bounds.y + bounds.height <= area.y + area.height);
    }
  }
});
test('remote web view bounds are finite and clipped to the local window', () => {
  assert.equal(core.viewBounds({x:NaN,y:0,width:1,height:1}, {width:980,height:746}), null);
  assert.deepEqual(core.viewBounds({x:-5,y:700,width:9000,height:1000}, {width:980,height:746}), {x:0,y:700,width:980,height:46});
});
test('prompts travel on stdin and ChatGPT sign-in is enforced without an API key', () => {
  const args = core.codexArgs('/tmp/a folder', 'workspace-write');
  assert(args.includes('forced_login_method="chatgpt"'));
  assert(args.includes('approval_policy="never"'));
  assert(args.includes('workspace-write'));
  assert.equal(args.at(-1), '-');
  assert(!args.join(' ').includes('danger-full-access'));
  assert.throws(() => core.codexArgs('/tmp', 'danger-full-access'));
  const env = core.codexEnvironment({OPENAI_API_KEY:'secret',CODEX_API_KEY:'secret',CODEX_ACCESS_TOKEN:'secret',PATH:'/bin'});
  assert.equal(env.OPENAI_API_KEY, undefined); assert.equal(env.CODEX_ACCESS_TOKEN, undefined); assert.equal(env.PATH, '/bin');
  assert.throws(() => core.validatePrompt(' '));
  assert.throws(() => core.validatePrompt('a'.repeat(24001)));
});
test('only explicit completion is success; error events remain errors', () => {
  assert.equal(core.eventSummary({type:'turn.completed'}).kind,'done');
  assert.equal(core.eventSummary({type:'turn.failed',error:{message:'No quota'}}).kind,'error');
  assert.equal(core.eventSummary({type:'item.completed',item:{type:'agent_message',text:'<script>evil</script>'}}).text,'<script>evil</script>');
  assert.equal(core.eventSummary({type:'item.started',item:{type:'agent_message',text:'partial'}}),null);
});
