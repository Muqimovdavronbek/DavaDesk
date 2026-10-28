'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {fileList,dropFiles,readMedia,pasteKey}=require('../lib/clipboard.cjs');
test('native file lists decode names, skip remote URLs and deduplicate',()=>{
 assert.deepEqual(fileList('copy\nfile:///tmp/a%20b.mp4\nhttps://example.com/a\nfile://server/share/a\nfile:///tmp/a%20b.mp4','linux'),['/tmp/a b.mp4']);
 assert.deepEqual(fileList('file:///C:/Users/Test/a%20b.png','win32'),['C:\\Users\\Test\\a b.png']);
 assert.deepEqual(fileList('/etc/passwd\nfile:///tmp/a%00.png','linux'),[]);
});
test('Windows file drops accept wide local paths and reject malformed offsets',()=>{
 const names=Buffer.from('C:\\test\\clip.mp4\0\0','utf16le'),header=Buffer.alloc(20);header.writeUInt32LE(20);header.writeUInt32LE(1,16);
 assert.deepEqual(dropFiles(Buffer.concat([header,names])),['C:\\test\\clip.mp4']);header.writeUInt32LE(99999);assert.deepEqual(dropFiles(Buffer.concat([header,names])),[]);
});
test('clipboard is read only on explicit paste; file formats take precedence over thumbnail',()=>{
 const data=readMedia({availableFormats:()=>['text/uri-list'],readBuffer:()=>Buffer.from('file:///tmp/video.mp4'),readImage:()=>{throw Error('thumbnail must not replace video');}},'linux');
 assert.deepEqual(data,{files:['/tmp/video.mp4']});
 assert.equal(pasteKey({type:'keyDown',key:'v',control:true}),true);
 assert.equal(pasteKey({type:'keyDown',key:'v',control:true,isAutoRepeat:true}),false);
 assert.equal(pasteKey({type:'keyUp',key:'v',control:true}),false);
 assert.equal(pasteKey({type:'keyDown',key:'v',control:true,shift:true}),false);
});
