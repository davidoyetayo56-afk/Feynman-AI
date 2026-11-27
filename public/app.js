const $ = (id) => document.getElementById(id);
let session = { material: "", topic: "", level: "university", question: "", previousFeedback: "" };
let currentFile = null;
let sessionFile = null;
function toast(message) { const el=$("toast"); el.textContent=message; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),3500); }
function busy(button, on, label) { button.disabled=on; if(on){button.dataset.old=button.textContent;button.textContent=label||"Working...";}else{button.textContent=button.dataset.old||"Continue";} }
async function api(url, body) {
  const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error||"Something went wrong.");
  return data;
}
$("pdf").addEventListener("change", async e=>{
  const file=e.target.files[0]; currentFile=null;
  if(!file)return;
  if(file.type!=="application/pdf"){toast("Please choose a PDF file.");e.target.value="";return;}
  if(file.size>13*1024*1024){toast("Please choose a PDF under 13 MB.");e.target.value="";return;}
  $("file-name").textContent=file.name;
  currentFile={mimeType:file.type,data:await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(",")[1]);r.onerror=reject;r.readAsDataURL(file);})};
});
$("start").addEventListener("click",async()=>{
  const text=$("notes").value.trim();
  if(!text&&!currentFile){toast("Upload a PDF or paste your notes first.");return;}
  session={...session,material:text,level:$("level").value};
  sessionFile=currentFile;
  const btn=$("start");busy(btn,true,"Building your map...");
  try{
    const data=await api("/api/analyze",{text,file:currentFile,level:session.level});
    $("map-title").textContent=data.title||"Your learning map";
    $("map-overview").textContent=data.overview||"Your material has been organized into topics.";
    $("question").textContent=data.first_question||"Explain the central idea in your own words.";
    session.question=$("question").textContent;
    const topics=data.topics||[];
    $("topic-list").innerHTML=topics.map(t=>`<article class="topic"><h3>${escapeHtml(t.name)}</h3><p>${escapeHtml(t.description||"")}</p><ul>${(t.subtopics||[]).map(s=>`<li>${escapeHtml(s)}</li>`).join("")}</ul></article>`).join("");
    $("learning").classList.remove("hidden");$("feedback").classList.add("hidden");
    $("learning").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(e){toast(e.message);}finally{busy(btn,false);}
});
$("submit-answer").addEventListener("click",async()=>{
  const answer=$("answer").value.trim();if(!answer){toast("Write or speak your explanation first.");return;}
  const btn=$("submit-answer");busy(btn,true,"Assessing...");
  try{
    const data=await api("/api/assess",{material:session.material,topic:$("map-title").textContent,level:session.level,question:session.question,answer,previousFeedback:session.previousFeedback,file:sessionFile});
    renderReport(data);session.previousFeedback=JSON.stringify(data).slice(0,2500);
    $("feedback").classList.remove("hidden");$("feedback").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(e){toast(e.message);}finally{busy(btn,false);}
});
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function list(items){return (items||[]).map(x=>`<li>${escapeHtml(typeof x==="string"?x:(x.claim+" — "+x.correction+" "+(x.why||"")))}</li>`).join("");}
function renderReport(d){
 const score=Number(d.score)||0;
 const categories=["accuracy","completeness","clarity","reasoning","terminology"];
 $("report").innerHTML=`<div class="score-panel"><div class="score">${score}<small style="font-size:15px">/100</small></div><div><h3>${escapeHtml(d.grade||"Assessment")}</h3><p>${escapeHtml(d.verdict||"Review your feedback below.")}</p></div></div>
 <div class="rubric">${categories.map(k=>`<div class="rubric-item"><strong>${k[0].toUpperCase()+k.slice(1)}</strong><span>${Number(d[k]?.score)||0}/100</span><p>${escapeHtml(d[k]?.feedback||"")}</p></div>`).join("")}</div>
 <div class="report-block"><h3>What you got right</h3><ul>${list(d.correct_points)}</ul></div>
 <div class="report-block"><h3>Misconceptions to correct</h3><ul>${list(d.misconceptions)}</ul></div>
 <div class="report-block"><h3>Concepts you missed</h3><ul>${list(d.missing_concepts)}</ul></div>
 <div class="report-block"><h3>Important terminology</h3><ul>${list(d.keywords_to_include)}</ul></div>
 <div class="report-block"><h3>A stronger explanation</h3><p>${escapeHtml(d.model_explanation||"")}</p></div>
 <div class="next-question"><strong>${d.mastery_achieved?"MASTERY CHECK":"YOUR NEXT STEP"}</strong><p>${escapeHtml(d.follow_up_question||d.next_step||"Review the feedback and explain the concept again.")}</p><button class="primary" id="continue">Try the next question →</button></div>`;
 $("continue").addEventListener("click",()=>{
   session.question=d.follow_up_question||"Explain the concept again, correcting the gaps identified above.";
   $("question").textContent=session.question;$("answer").value="";
   $("learning").scrollIntoView({behavior:"smooth",block:"start"});
 });
}
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
if(!SpeechRecognition){$("mic").disabled=true;$("mic").title="Speech recognition is not supported in this browser.";}
else $("mic").addEventListener("click",()=>{
 const rec=new SpeechRecognition();rec.lang="en-NG";rec.interimResults=true;rec.continuous=true;
 $("mic-status").textContent="Listening… speak clearly.";
 rec.onresult=e=>{let text="";for(let i=0;i<e.results.length;i++)text+=e.results[i][0].transcript+" ";$("answer").value=text.trim();};
 rec.onerror=()=>{$("mic-status").textContent="Microphone unavailable. You can type instead.";};
 rec.onend=()=>{$("mic-status").textContent="";};rec.start();
});