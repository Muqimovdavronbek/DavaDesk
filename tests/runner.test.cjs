'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { CodexRunner, loginStatus } = require('../lib/codex.cjs');

function fixture(t, source) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'davadesk-test-'));
  const executable = path.join(root,'fake-codex');
  fs.writeFileSync(executable,'#!' + process.execPath + '\n' + source,{mode:0o700});
  t.after(() => fs.rmSync(root,{recursive:true,force:true}));
  return {root,executable};
}
test('a completed CLI job returns real message events and receives shell text as data', async t => {
  const {root,executable}=fixture(t,`
    let prompt=''; process.stdin.setEncoding('utf8');
    process.stdin.on('data',b=>prompt+=b);
    process.stdin.on('end',()=>{
      const fs=require('node:fs');
      fs.writeFileSync('received.json',JSON.stringify({args:process.argv.slice(2),prompt,key:process.env.OPENAI_API_KEY||null}));
      process.stdout.write('not-json diagnostic\\n');
      process.stdout.write(JSON.stringify({type:'thread.started',thread_id:'test'})+'\\n');
      const value=JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Tayyor — o‘zbekcha'}})+'\\n';
      const b=Buffer.from(value); process.stdout.write(b.subarray(0,35)); process.stdout.write(b.subarray(35));
      process.stdout.write(JSON.stringify({type:'turn.completed'}));
    });
  `);
  const runner=new CodexRunner(executable), events=[];
  runner.on('event',e=>events.push(e));
  const finished=once(runner,'finish');
  runner.start('Create $(touch NEVER_EXECUTE) and `whoami` as literal text',root,'read-only');
  const [result]=await finished;
  assert.equal(result.success,true);
  assert.equal(events.find(x=>x.kind==='answer').text,'Tayyor — o‘zbekcha');
  const received=JSON.parse(fs.readFileSync(path.join(root,'received.json')));
  assert(received.prompt.includes('$(touch NEVER_EXECUTE)'));
  assert.equal(received.key,null);
  assert.equal(fs.existsSync(path.join(root,'NEVER_EXECUTE')),false);
  assert.equal(received.args.at(-1),'-');
});
test('a zero exit without completion is never presented as a finished task', async t => {
  const {root,executable}=fixture(t,`process.stdin.resume();process.stdin.on('end',()=>process.exit(0));`);
  const runner=new CodexRunner(executable), finished=once(runner,'finish');
  runner.start('test',root,'read-only');
  const [result]=await finished;assert.equal(result.success,false);
});
test('failure event prevents success even if completion and exit zero also arrive', async t => {
  const {root,executable}=fixture(t,`process.stdin.resume();process.stdin.on('end',()=>{console.log(JSON.stringify({type:'error',message:'Quota'}));console.log(JSON.stringify({type:'turn.completed'}));});`);
  const runner=new CodexRunner(executable), finished=once(runner,'finish');
  runner.start('test',root,'read-only'); const [result]=await finished;assert.equal(result.success,false);
});
test('stop kills the process group and records cancellation without a success message', async t => {
  const {root,executable}=fixture(t,`process.stdin.resume();setInterval(()=>{},1000);console.log(JSON.stringify({type:'thread.started'}));`);
  const runner=new CodexRunner(executable), event=once(runner,'event'), finished=once(runner,'finish');
  runner.start('test',root,'workspace-write');
  await event; assert.equal(runner.stop(),true);
  const [result]=await finished;assert.equal(result.cancelled,true);assert.equal(result.success,false);assert.equal(runner.child,null);
});
test('login status accepts only ChatGPT sign-in, and handles a missing executable', async t => {
  const {executable}=fixture(t,`console.error('Logged in using ChatGPT');`);
  assert.equal((await loginStatus(executable)).authenticated,true);
  assert.equal((await loginStatus(null)).installed,false);
  assert.equal((await loginStatus('/does/not/exist')).authenticated,false);
});
test('an API-key status is not accepted for the subscription-only app', async t => {
  const {executable}=fixture(t,`console.error('Logged in using an API key');`);
  assert.equal((await loginStatus(executable)).authenticated,false);
});
