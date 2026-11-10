export function createImportJob(files,{onProgress=()=>{}}={}){
 let worker,settled=false,rejectPromise;
 const promise=new Promise((resolve,reject)=>{
  rejectPromise=reject;
  try{worker=new Worker(new URL('./import-worker.js',import.meta.url),{type:'module'});}catch{
   settled=true;reject(Error('Private background processing is unavailable in this browser. Open this app in a current Safari, Chrome, Firefox, or Edge tab.'));return;
  }
  worker.onmessage=event=>{
   if(settled)return;
   const data=event.data;
   if(data.type==='progress'){onProgress(data.progress);return;}
   settled=true;worker.terminate();
   if(data.type==='result')resolve(data.result);
   else {const error=Error(data.error?.message||'Import failed.');error.name=data.error?.name||'Error';error.warnings=data.error?.warnings||[];reject(error);}
  };
  worker.onerror=()=>{if(settled)return;settled=true;worker.terminate();reject(Error('Background import stopped. Try a smaller Posts-only export in a current browser.'));};
  worker.postMessage({files:Array.from(files)});
 });
 return {promise,cancel(){if(settled)return;settled=true;worker?.terminate();rejectPromise(new DOMException('Import canceled.','AbortError'));}};
}
