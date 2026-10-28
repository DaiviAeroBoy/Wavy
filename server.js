// Tiny local server: serves the app and streams registered media files with Range support (needed for seeking).
const http=require('http'),fs=require('fs'),path=require('path');
const MIME={'.mp3':'audio/mpeg','.flac':'audio/flac','.wav':'audio/wav','.m4a':'audio/mp4','.ogg':'audio/ogg','.opus':'audio/ogg','.aac':'audio/aac','.weba':'audio/webm','.mp4':'video/mp4','.m4v':'video/mp4','.mov':'video/mp4','.webm':'video/webm','.mkv':'video/x-matroska'};
const send=(s,r)=>s.on('error',()=>r.destroy()).pipe(r);
module.exports=(tok,reg,indexFile)=>new Promise(res=>{
  const srv=http.createServer((q,r)=>{
    const m=q.url.match(/^\/m\/([a-f0-9]+)\/([a-f0-9]+)/);
    if(!m){if(q.url==='/'||q.url.startsWith('/?')){r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return send(fs.createReadStream(indexFile),r)}r.writeHead(404);return r.end()}
    const p=m[1]===tok&&reg.get(m[2]);if(!p){r.writeHead(403);return r.end()}
    fs.stat(p,(e,s)=>{
      if(e){r.writeHead(404);return r.end()}
      const mt=MIME[path.extname(p).toLowerCase()]||'application/octet-stream',h=q.headers.range;
      if(!h){r.writeHead(200,{'Content-Type':mt,'Accept-Ranges':'bytes','Content-Length':s.size});return send(fs.createReadStream(p),r)}
      const g=/bytes=(\d*)-(\d*)/.exec(h)||['','0',''];let a=g[1]?+g[1]:0,b=g[2]?+g[2]:s.size-1;
      if(!g[1]&&g[2]){a=Math.max(0,s.size-+g[2]);b=s.size-1}b=Math.min(b,s.size-1);
      if(a>b||a>=s.size){r.writeHead(416,{'Content-Range':`bytes */${s.size}`});return r.end()}
      r.writeHead(206,{'Content-Type':mt,'Accept-Ranges':'bytes','Content-Range':`bytes ${a}-${b}/${s.size}`,'Content-Length':b-a+1});
      send(fs.createReadStream(p,{start:a,end:b}),r);
    });
  }).listen(0,'127.0.0.1',()=>res(srv.address().port));
});
