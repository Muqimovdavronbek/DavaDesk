'use strict';
const {fileURLToPath}=require('node:url');
const path=require('node:path');
// Only native file-list formats are paths. Plain text is never treated as a file.
function fileList(value,platform=process.platform) {
 const lines=String(value).replace(/\0/g,'').split(/\r?\n/);
 const files=[];
 for(const line of lines) {
  if(!line.startsWith('file:'))continue;
  try {
   const url=new URL(line);
   if(url.hostname && url.hostname!=='localhost')continue;
   let file=platform==='win32' ? decodeURIComponent(url.pathname).replace(/^\/([A-Za-z]:\/)/,'$1').replace(/\//g,'\\') : fileURLToPath(url);
   if(file.includes('\0') || !(platform==='win32'?path.win32:path.posix).isAbsolute(file))continue;
   if(!files.includes(file))files.push(file);
  }catch{}
 }
 return files;
}
function dropFiles(buffer) {
 if(!Buffer.isBuffer(buffer)||buffer.length<20)return [];
 const offset=buffer.readUInt32LE(0);
 if(offset<20||offset>=buffer.length||buffer.readUInt32LE(16)!==1)return [];
 return buffer.subarray(offset).toString('utf16le').split('\0').filter(f=>/^[A-Za-z]:\\/.test(f));
}
function readMedia(clipboard,platform=process.platform) {
 const formats=clipboard.availableFormats();
 for(const format of ['x-special/gnome-copied-files','x-special/nautilus-clipboard','text/uri-list']) {
  if(!formats.includes(format))continue;
  const files=fileList(clipboard.readBuffer(format).toString('utf8'),platform);
  if(files.length)return {files};
 }
 if(platform==='win32' && formats.includes('CF_HDROP')) {
  const files=dropFiles(clipboard.readBuffer('CF_HDROP'));
  if(files.length)return {files};
 }
 if(platform==='win32' && formats.includes('FileNameW')) {
  const file=clipboard.readBuffer('FileNameW').toString('utf16le').split('\0')[0];
  if(/^[A-Za-z]:\\/.test(file))return {files:[file]};
 }
 const image=clipboard.readImage();
 if(!image.isEmpty())return {png:image.toPNG()};
 return null;
}
function pasteKey(input) {
 return input.type==='keyDown'&&!input.isAutoRepeat&&!input.isComposing&&!input.alt&&
 (((input.control||input.meta)&&!input.shift&&String(input.key).toLowerCase()==='v') ||
 (input.shift&&!input.control&&!input.meta&&input.key==='Insert'));
}
module.exports={fileList,dropFiles,readMedia,pasteKey};
