
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {findCodex}=require('../lib/codex.cjs');
test('Windows resolves the bundled native codex.exe, never a Unix or cmd shim',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dava-win-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const bin=path.join(root,'tools','vendor','x86_64-pc-windows-msvc','bin');
 fs.mkdirSync(bin,{recursive:true});const exe=path.join(bin,'codex.exe');fs.writeFileSync(exe,'fixture',{mode:0o755});
 assert.equal(findCodex(root,{PATH:''},'win32','x64'),exe);
 fs.unlinkSync(exe);
 fs.mkdirSync(path.join(root,'node_modules','.bin'),{recursive:true});
 fs.writeFileSync(path.join(root,'node_modules','.bin','codex.cmd'),'fixture',{mode:0o755});
 assert.equal(findCodex(root,{PATH:''},'win32','x64'),null);
});
