const {contextBridge,ipcRenderer:r}=require('electron');
contextBridge.exposeInMainWorld('api',{
  oembed:u=>r.invoke('oembed',u),
  lib:{get:()=>r.invoke('lib:get'),add:()=>r.invoke('lib:add'),remove:f=>r.invoke('lib:remove',f),openDl:()=>r.invoke('dl:open')},
  dl:(u,q)=>r.invoke('dl:run',u,q),
  onDl:cb=>r.on('dl:p',(_,d)=>cb(d)),
  opened:()=>r.invoke('open:pending'),
  onOpen:cb=>r.on('open',(_,t)=>cb(t))
});
