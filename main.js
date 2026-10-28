const {app,BrowserWindow,ipcMain,dialog,shell}=require('electron');
const path=require('path'),fs=require('fs'),cp=require('child_process'),crypto=require('crypto');
const {Readable}=require('stream'),{pipeline}=require('stream/promises'),exec=require('util').promisify(cp.execFile);
const startServer=require('./server');
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
if(!app.requestSingleInstanceLock()){app.quit();return}

const MED=/\.(mp3|flac|wav|m4a|ogg|opus|aac|wma|weba|mp4|m4v|mov|webm|mkv)$/i,VID=/\.(mp4|m4v|mov|webm|mkv)$/i;
const TOK=crypto.randomBytes(16).toString('hex'),reg=new Map();
let win,port,pending=process.argv.slice(1).filter(f=>MED.test(f));

// ---------- library ----------
const cfgF=()=>path.join(app.getPath('userData'),'config.json');
const cfg=()=>{let c={};try{c=JSON.parse(fs.readFileSync(cfgF(),'utf8'))}catch{}c.folders=c.folders||[];return c};
const save=c=>{fs.mkdirSync(path.dirname(cfgF()),{recursive:true});fs.writeFileSync(cfgF(),JSON.stringify(c))};
const dlDir=()=>path.join(app.getPath('music'),'Downloaded Songs');
const idOf=p=>{const id=crypto.createHash('md5').update(p).digest('hex').slice(0,16);reg.set(id,p);return id};
const trk=(p,root)=>({key:'f:'+p,name:path.basename(p),vid:VID.test(p),url:`/m/${TOK}/${idOf(p)}`,
  folder:root?path.relative(path.dirname(root),path.dirname(p)).split(path.sep).join('/'):path.basename(path.dirname(p))});
async function walk(d,out){let es;try{es=await fs.promises.readdir(d,{withFileTypes:true})}catch{return}
  for(const e of es){const p=path.join(d,e.name);if(e.isDirectory())await walk(p,out);else if(MED.test(e.name))out.push(p)}}
async function lib(){const c=cfg(),tracks=[];for(const f of c.folders){const ps=[];await walk(f,ps);ps.forEach(p=>tracks.push(trk(p,f)))}return{folders:c.folders,tracks}}

// ---------- yt-dlp (uses yours if installed, otherwise fetches it from GitHub) ----------
const YT='https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
const FF='https://github.com/yt-dlp/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip';
const bin=()=>path.join(app.getPath('userData'),'bin');
const where=n=>{try{return cp.execFileSync('where',[n],{encoding:'utf8',windowsHide:true}).split(/\r?\n/)[0].trim()||null}catch{return null}};
const local=n=>{const p=path.join(bin(),n+'.exe');return fs.existsSync(p)?p:null};
async function fetchTo(url,dest,cb){const r=await fetch(url);if(!r.ok)throw new Error('Download failed (HTTP '+r.status+')');
  const tot=+r.headers.get('content-length')||0;let got=0;const rs=Readable.fromWeb(r.body);rs.on('data',c=>{got+=c.length;if(tot)cb(got/tot)});
  await pipeline(rs,fs.createWriteStream(dest))}
async function runDl(url,q,send){try{
  if(!/^https?:\/\//.test(String(url)))throw new Error('Invalid link');
  q=Math.min(9,Math.max(0,parseInt(q)));if(isNaN(q))q=2;fs.mkdirSync(bin(),{recursive:true});
  let y=where('yt-dlp')||local('yt-dlp');const old=y,stale=y&&y.startsWith(bin())&&Date.now()-fs.statSync(y).mtimeMs>7*864e5;
  if(!y||stale){const t='Getting yt-dlp from GitHub…',dest=path.join(bin(),'yt-dlp.exe');send({stage:t,p:0});
    try{await fetchTo(YT,dest+'.part',p=>send({stage:t,p}));fs.renameSync(dest+'.part',dest);y=dest}catch(e){if(!old)throw e;y=old}}
  if(!where('ffmpeg')&&!local('ffmpeg')){const t='Getting ffmpeg (one time, large)…',z=path.join(bin(),'ffmpeg.zip'),d=path.join(bin(),'ff');
    send({stage:t,p:0});await fetchTo(FF,z,p=>send({stage:t,p}));send({stage:'Unpacking ffmpeg…',p:1});
    fs.rmSync(d,{recursive:true,force:true});fs.mkdirSync(d);await exec('tar',['-xf',z,'-C',d],{windowsHide:true});
    const sub=fs.readdirSync(d)[0];for(const n of['ffmpeg.exe','ffprobe.exe'])fs.copyFileSync(path.join(d,sub,'bin',n),path.join(bin(),n));
    fs.rmSync(d,{recursive:true,force:true});fs.rmSync(z,{force:true})}
  const out=dlDir();fs.mkdirSync(out,{recursive:true});
  const args=['-x','--audio-format','mp3','--audio-quality',String(q),'--embed-thumbnail','--convert-thumbnails','jpg','--embed-metadata','--no-playlist','--windows-filenames','--trim-filenames','150','--newline','--no-mtime','-P',out,'-o','%(title)s.%(ext)s'];
  if(!where('ffmpeg'))args.push('--ffmpeg-location',bin());
  const env={...process.env};if(!where('deno')){args.push('--js-runtimes','node:'+process.execPath);env.ELECTRON_RUN_AS_NODE='1'} // YouTube needs a JS runtime
  args.push('--',url);send({stage:'Downloading audio…',p:0});
  const name=await new Promise((ok,no)=>{const c=cp.spawn(y,args,{windowsHide:true,env});let dest='',err='',buf='';
    const line=s=>{let m;if(m=s.match(/\[download\]\s+([\d.]+)%/))send({stage:'Downloading audio…',p:Math.min(.9,m[1]/100*.9)});
      else if(/\[(ExtractAudio|Metadata|EmbedThumbnail|ThumbnailsConvertor)\]/.test(s))send({stage:'Converting to MP3…',p:.95});
      if(m=s.match(/\[ExtractAudio\] Destination: (.+)/))dest=m[1].trim()};
    c.stdout.on('data',d=>{buf+=d;const ls=buf.split(/\r?\n|\r/);buf=ls.pop();ls.forEach(line)});
    c.stderr.on('data',d=>err+=d);c.on('error',no);
    c.on('close',code=>code===0?ok(dest?path.basename(dest,'.mp3'):'Song'):no(new Error((err.trim().split('\n').pop()||'yt-dlp failed').slice(0,300))))});
  return{ok:true,name}}catch(e){return{ok:false,err:String(e.message||e)}}}

// ---------- window ----------
function createWindow(){
  win=new BrowserWindow({width:1280,height:820,minWidth:860,minHeight:560,backgroundColor:'#141218',autoHideMenuBar:true,title:'Wavy',icon:path.join(__dirname,'build','icon.png'),
    webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,sandbox:true}});
  win.webContents.setWindowOpenHandler(({url,frameName})=>{
    if(frameName==='mini')return{action:'allow',overrideBrowserWindowOptions:{width:360,height:132,frame:false,alwaysOnTop:true,resizable:false,autoHideMenuBar:true}};
    if(/^https:\/\/([\w-]+\.)*spotify\.com\//.test(url))return{action:'allow'};
    if(/^https?:/.test(url))shell.openExternal(url);return{action:'deny'}});
  win.loadURL(`http://127.0.0.1:${port}/`);
}
app.on('second-instance',(_,argv)=>{if(!win)return;if(win.isMinimized())win.restore();win.focus();
  const f=argv.slice(1).filter(x=>MED.test(x)&&fs.existsSync(x));if(f.length)win.webContents.send('open',f.map(p=>trk(p)))});
ipcMain.handle('lib:get',()=>lib());
ipcMain.handle('lib:add',async()=>{const r=await dialog.showOpenDialog(win,{title:'Add music folder',properties:['openDirectory']});if(r.canceled)return null;
  const c=cfg();r.filePaths.forEach(f=>{if(!c.folders.includes(f))c.folders.push(f)});save(c);return lib()});
ipcMain.handle('lib:remove',(_,f)=>{const c=cfg();c.folders=c.folders.filter(x=>x!==f);save(c);return lib()});
ipcMain.handle('dl:open',()=>{fs.mkdirSync(dlDir(),{recursive:true});shell.openPath(dlDir())});
ipcMain.handle('dl:run',(e,url,q)=>runDl(url,q,d=>e.sender.send('dl:p',d)));
ipcMain.handle('open:pending',()=>pending.filter(f=>fs.existsSync(f)).map(p=>trk(p)));
ipcMain.handle('oembed',async(_,u)=>{if(!/^https:\/\/(www\.youtube\.com\/oembed|open\.spotify\.com\/oembed)\?/.test(u))return null;try{return await (await fetch(u)).json()}catch{return null}});
app.whenReady().then(async()=>{
  const c=cfg();fs.mkdirSync(dlDir(),{recursive:true});if(!c.init){c.init=1;c.folders.unshift(dlDir());save(c)} // Downloaded Songs is a library folder by default
  port=await startServer(TOK,reg,path.join(__dirname,'app','index.html'));createWindow();
  if(app.isPackaged&&!process.env.PORTABLE_EXECUTABLE_DIR){try{require('electron-updater').autoUpdater.checkForUpdatesAndNotify().catch(()=>{})}catch{}}
});
app.on('window-all-closed',()=>app.quit());
