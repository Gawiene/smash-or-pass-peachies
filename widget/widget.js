/* Smash or Pass Peachies — exécuter dans le Custom Widget StreamElements. */
(function () {
"use strict";
if (window.__sopPeachiesMounted) return;
window.__sopPeachiesMounted = true;
const mount = document.createElement("div");
mount.id = "sopPeachiesRoot";
mount.innerHTML = "<div class=\"sop-widget\">\n  <div class=\"sop-load-status\" id=\"sopLoadStatus\" role=\"status\">Chargement du deck…</div>\n  <div class=\"game-screen card-stack hidden\" id=\"gameScreen\">\n    <div class=\"card\" id=\"card\">\n      <div class=\"game-topbar\">\n        <div class=\"game-title\">SMASH OR PASS</div>\n        <div class=\"card-counter\" id=\"cardProgress\">0 / 0</div>\n      </div>\n      <div class=\"character-stage\">\n        <div class=\"floating-choice floating-pass\">\n          <div class=\"floating-icon\">✕</div>\n          <div class=\"floating-label\">PASS</div>\n        </div>\n        <div class=\"image-wrapper\">\n          <img id=\"characterImage\" src=\"\" alt=\"\" />\n          <div class=\"image-gradient\"></div>\n          <div class=\"result-overlay\" id=\"result\">\n            <div class=\"result-line result-streamer\">\n              <span class=\"result-small\">STREAMER</span>\n              <span class=\"result-value\" id=\"resultStreamer\"></span>\n            </div>\n            <div class=\"result-separator\"></div>\n            <div class=\"result-line result-chat\">\n              <span class=\"result-small\">CHAT</span>\n              <span class=\"result-value\" id=\"resultChat\"></span>\n            </div>\n          </div>\n          <div class=\"swipe-stamp stamp-pass\">PASS</div>\n          <div class=\"swipe-stamp stamp-smash\">SMASH</div>\n          <div class=\"character-info\">\n            <div class=\"character-name\" id=\"characterName\">Personnage</div>\n            <div class=\"character-origin\" id=\"characterOrigin\"></div>\n            <div class=\"character-credit\" id=\"characterCredit\"></div>\n          </div>\n        </div>\n        <div class=\"floating-choice floating-smash\">\n          <div class=\"floating-icon\">♥</div>\n          <div class=\"floating-label\">SMASH</div>\n        </div>\n      </div>\n      <div class=\"vote-zone\">\n        <div class=\"vote-row\">\n          <div class=\"vote-side pass-value\">\n            <span class=\"vote-symbol\">✕</span>\n            <span class=\"vote-label\">PASS</span>\n            <strong><span id=\"passPercent\">50</span>%</strong>\n          </div>\n          <div class=\"vote-count\"><span id=\"voteCount\">0</span> vote(s)</div>\n          <div class=\"vote-side smash-value\">\n            <strong><span id=\"smashPercent\">50</span>%</strong>\n            <span class=\"vote-label\">SMASH</span>\n            <span class=\"vote-symbol\">♥</span>\n          </div>\n        </div>\n        <div class=\"vote-bar\">\n          <div class=\"pass-bar\" id=\"passBar\"></div>\n          <div class=\"smash-bar\" id=\"smashBar\"></div>\n        </div>\n      </div>\n    </div>\n  </div>\n\n  <div class=\"summary\" id=\"summaryScreen\">\n    <div class=\"summary-header\">\n      <div>\n        <div class=\"summary-title\">RÉCAP SMASH OR PASS</div>\n        <div class=\"summary-subtitle\">Résultats de la session</div>\n      </div>\n      <div class=\"summary-finish-icon\">✓</div>\n    </div>\n    <div class=\"summary-section\">\n      <div class=\"summary-section-title\">🎙 CHOIX DU STREAMER</div>\n      <div class=\"summary-choice-grid\">\n        <div class=\"summary-choice summary-smash\"><span class=\"summary-choice-icon\">♥</span><strong id=\"streamerSmashCount\">0</strong><span>SMASH</span></div>\n        <div class=\"summary-choice summary-pass\"><span class=\"summary-choice-icon\">✕</span><strong id=\"streamerPassCount\">0</strong><span>PASS</span></div>\n      </div>\n    </div>\n    <div class=\"summary-section\">\n      <div class=\"summary-section-title\">💬 TENDANCE DU CHAT</div>\n      <div class=\"summary-chat-grid\">\n        <div class=\"summary-mini-stat\"><strong id=\"chatSmashCount\">0</strong><span>♥ Smash</span></div>\n        <div class=\"summary-mini-stat\"><strong id=\"chatPassCount\">0</strong><span>✕ Pass</span></div>\n        <div class=\"summary-mini-stat\"><strong id=\"chatTieCount\">0</strong><span>= 50/50</span></div>\n        <div class=\"summary-mini-stat\"><strong id=\"chatNoVoteCount\">0</strong><span>Aucun vote</span></div>\n      </div>\n    </div>\n    <div class=\"summary-section\">\n      <div class=\"summary-section-title\">🔥 LES EXTRÊMES DU CHAT</div>\n      <div class=\"summary-highlight top-smash\" id=\"topSmash\">♥ Plus gros Smash : —</div>\n      <div class=\"summary-highlight top-pass\" id=\"topPass\">✕ Plus gros Pass : —</div>\n    </div>\n  </div>\n\n  <div class=\"debug-panel hidden\" id=\"debugPanel\">\n    <div class=\"debug-title\">🔧 DEBUG</div>\n    <div class=\"debug-status\" id=\"debugStatus\">Chargement…</div>\n    <div class=\"debug-log\" id=\"debugLog\"></div>\n  </div>\n</div>";
document.body.appendChild(mount);
const loaderStatus = document.getElementById("sop-loader-status");
if (loaderStatus) loaderStatus.remove();
const hostedImage = document.getElementById("characterImage");
if (hostedImage) hostedImage.referrerPolicy = "no-referrer";
const widgetRoot = mount.querySelector(".sop-widget");
const colorFields = {"widgetBackgroundColor": "--widget-bg", "widgetSecondaryColor": "--widget-soft", "widgetTextColor": "--widget-text", "widgetSecondaryTextColor": "--widget-text-soft", "widgetBorderColor": "--widget-border", "widgetSmashColor": "--widget-smash", "widgetPassColor": "--widget-pass", "imageFallbackColor": "--image-fallback", "imageOverlayColor": "--image-overlay", "imageNameColor": "--image-name", "imageSubtitleColor": "--image-subtitle", "resultBackgroundColor": "--result-bg", "resultLabelColor": "--result-label", "resultTextColor": "--result-text", "resultSmashColor": "--result-smash", "resultPassColor": "--result-pass", "summaryBackgroundColor": "--summary-bg", "summaryCardColor": "--summary-card", "summaryTextColor": "--summary-text", "summarySecondaryTextColor": "--summary-text-soft", "summaryBorderColor": "--summary-border", "summarySmashColor": "--summary-smash", "summaryPassColor": "--summary-pass", "shadowColor": "--shadow", "debugBackgroundColor": "--debug-bg", "debugTextColor": "--debug-text", "debugStatusColor": "--debug-status"};
const STORE_KEY = "smashorpassv3";
const STATE_VERSION = 3;

let characters = [];
let deck = [];
let currentIndex = 0;
let deckOrder = "normal";
let deckSeed = 1;
let smashVotes = 0;
let passVotes = 0;
let isAnimating = false;
let gameFinished = false;
const viewerVotes = {};
const gameResults = [];
let deckSignature = "";
let sharedRevision = 0;
let lastSeenActionId = "";
let voteSaveTimer = null;
const ownActionIds = new Set();

let lastButtonField = "";
let lastButtonTime = 0;
function isDuplicateButton(field) {
  const now = Date.now();
  const duplicate = field === lastButtonField && now - lastButtonTime < 300;
  lastButtonField = field;
  lastButtonTime = now;
  return duplicate;
}

const card = document.getElementById("card");
const gameScreen = document.getElementById("gameScreen");
const summaryScreen = document.getElementById("summaryScreen");
const cardProgress = document.getElementById("cardProgress");
const characterImage = document.getElementById("characterImage");
const characterName = document.getElementById("characterName");
const characterOrigin = document.getElementById("characterOrigin");
const characterCredit = document.getElementById("characterCredit");
const smashPercent = document.getElementById("smashPercent");
const passPercent = document.getElementById("passPercent");
const smashBar = document.getElementById("smashBar");
const passBar = document.getElementById("passBar");
const voteCount = document.getElementById("voteCount");
const result = document.getElementById("result");
const resultStreamer = document.getElementById("resultStreamer");
const resultChat = document.getElementById("resultChat");
const streamerSmashCount = document.getElementById("streamerSmashCount");
const streamerPassCount = document.getElementById("streamerPassCount");
const chatSmashCount = document.getElementById("chatSmashCount");
const chatPassCount = document.getElementById("chatPassCount");
const chatTieCount = document.getElementById("chatTieCount");
const chatNoVoteCount = document.getElementById("chatNoVoteCount");
const topSmash = document.getElementById("topSmash");
const topPass = document.getElementById("topPass");
const debugPanel = document.getElementById("debugPanel");
const debugStatus = document.getElementById("debugStatus");
const debugLog = document.getElementById("debugLog");

function setDebugStatus(message) { if (debugStatus) debugStatus.textContent = message; }
function debug(message) {
  if (!debugLog) return;
  const line = document.createElement("div");
  line.classList.add("debug-line");
  line.textContent = message;
  debugLog.prepend(line);
  while (debugLog.children.length > 18) debugLog.removeChild(debugLog.lastElementChild);
}

function parseCardsData(rawValue) {
  let parsed = rawValue;
  if (typeof rawValue === "string") {
    const clean = rawValue.trim();
    if (!clean) return [];
    try { parsed = JSON.parse(clean); } catch (error) { debug("❌ cardsData : JSON invalide"); return []; }
  }
  if (!Array.isArray(parsed)) { debug("❌ cardsData doit être un tableau"); return []; }
  const cards = [];
  parsed.forEach(function(entry,index) {
    if (!entry || typeof entry !== "object") return;
    const name = String(entry.name || "").trim();
    const origin = String(entry.origin || "").trim();
    const credit = String(entry.credit || "").trim();
    const image = String(entry.image || "").trim();
    if (!image) { debug("⚠ Carte " + String(index+1) + " ignorée : image manquante"); return; }
    cards.push({ name: name || "Carte " + String(index+1), origin, credit, image });
  });
  return cards;
}

function buildConfiguredCharacters(cardsData) {
  characters = parseCardsData(cardsData);
  deckSignature = characters.map(function(character) {
    return [character.name,character.origin,character.credit,character.image].join("|");
  }).join("||");
  if (characters.length > 0) setDebugStatus("✅ " + String(characters.length) + " carte(s) chargée(s)");
  else setDebugStatus("❌ Aucune carte chargée");
  debug("🎴 Deck : " + String(characters.length) + " carte(s)");
}

function hashString(value) { let hash=2166136261; for(let index=0;index<value.length;index+=1){ hash ^= value.charCodeAt(index); hash=Math.imul(hash,16777619);} return hash>>>0; }
function seededRandom(seed) { let value=seed>>>0; return function() { value += 0x6D2B79F5; let result=value; result=Math.imul(result ^ result>>>15,result|1); result ^= result + Math.imul(result ^ result>>>7,result|61); return ((result ^ result>>>14)>>>0)/4294967296; }; }
function buildDeck() { deck=characters.slice(); if(deckOrder!=="random") return; const seed=hashString(deckSignature+"|"+String(deckSeed)); const random=seededRandom(seed); for(let index=deck.length-1;index>0;index-=1){ const randomIndex=Math.floor(random()*(index+1)); const temp=deck[index]; deck[index]=deck[randomIndex]; deck[randomIndex]=temp; } }

function clearViewerVotes() { Object.keys(viewerVotes).forEach(function(key){delete viewerVotes[key];}); }
function copyViewerVotes(source) { clearViewerVotes(); if(!source || typeof source!=="object") return; Object.keys(source).forEach(function(key){ if(source[key]==="smash" || source[key]==="pass") viewerVotes[key]=source[key]; }); }
function copyGameResults(source) { gameResults.length=0; if(!Array.isArray(source)) return; source.forEach(function(entry){ if(entry && typeof entry==="object") gameResults.push(entry); }); }
function recalculateVotes(){ smashVotes=0;passVotes=0; Object.values(viewerVotes).forEach(function(vote){ if(vote==="smash") smashVotes+=1; if(vote==="pass") passVotes+=1; }); }
function getVoteData(){ const total=smashVotes+passVotes; if(total===0)return{total:0,smashPercentage:50,passPercentage:50,chatChoice:"none"}; const smashPercentage=Math.round((smashVotes/total)*100); const passPercentage=100-smashPercentage; let chatChoice="tie"; if(smashVotes>passVotes)chatChoice="smash"; if(passVotes>smashVotes)chatChoice="pass"; return{total,smashPercentage,passPercentage,chatChoice}; }
function updateVotes(){ recalculateVotes(); const voteData=getVoteData(); if(smashPercent)smashPercent.textContent=String(voteData.smashPercentage); if(passPercent)passPercent.textContent=String(voteData.passPercentage); if(voteCount)voteCount.textContent=String(voteData.total); if(smashBar)smashBar.style.width=voteData.smashPercentage+"%"; if(passBar)passBar.style.width=voteData.passPercentage+"%"; }
function hideResult(){ if(result)result.classList.remove("visible"); if(resultStreamer)resultStreamer.textContent=""; if(resultChat)resultChat.textContent=""; const streamerLine=document.querySelector(".result-streamer"); const chatLine=document.querySelector(".result-chat"); if(streamerLine)streamerLine.classList.remove("smash","pass"); if(chatLine)chatLine.classList.remove("smash","pass"); }
function renderCurrentCard(options){ const settings=options||{}; if(deck.length===0){ if(characterName)characterName.textContent="Aucune carte"; if(characterOrigin)characterOrigin.textContent=""; if(characterCredit)characterCredit.textContent=""; if(cardProgress)cardProgress.textContent="0 / 0"; if(characterImage)characterImage.removeAttribute("src"); updateVotes(); return; } const character=deck[currentIndex]; if(!character)return; if(settings.hideResult!==false)hideResult(); if(characterName)characterName.textContent=character.name; if(characterOrigin)characterOrigin.textContent=character.origin||""; if(characterCredit)characterCredit.textContent=character.credit?"Proposé par "+character.credit:""; if(characterImage){characterImage.src=character.image;characterImage.alt=character.name;} if(cardProgress)cardProgress.textContent=String(currentIndex+1)+" / "+String(deck.length); updateVotes(); }
function makeAction(type,data){ return Object.assign({ id:String(Date.now())+"_"+String(Math.random()), type },data||{}); }
function createSharedState(action){ sharedRevision+=1; return { version:STATE_VERSION, deckSignature, deckOrder, seed:deckSeed, currentIndex, viewerVotes:Object.assign({},viewerVotes), gameResults:gameResults.slice(), gameFinished, revision:sharedRevision, action:action||null, updatedAt:Date.now() }; }
function saveSharedState(action){
  if(typeof SE_API==="undefined" || !SE_API.store){ debug("⚠ Store StreamElements indisponible"); return; }
  const state=createSharedState(action);
  if(action && action.id){ ownActionIds.add(action.id); if(ownActionIds.size>100)ownActionIds.delete(ownActionIds.values().next().value); }
  try {
    const pending=SE_API.store.set(STORE_KEY,state);
    if(pending && typeof pending.catch==="function")pending.catch(function(){debug("❌ Écriture du store impossible");});
  } catch(error) { debug("❌ Écriture du store impossible"); }
}
function scheduleVoteSave(){ if(voteSaveTimer)clearTimeout(voteSaveTimer); voteSaveTimer=setTimeout(function(){ saveSharedState(makeAction("votes")); },150); }
function applySharedState(state,fromRemote){
  if(!state || typeof state!=="object")return false;
  if(state.version!==STATE_VERSION)return false;
  if(state.deckSignature!==deckSignature)return false;
  if(state.deckOrder!==deckOrder)return false;
  const previousIndex=currentIndex;
  const previousSeed=deckSeed;
  const previouslyFinished=gameFinished;
  deckSeed=Number(state.seed||1); buildDeck();
  currentIndex=Math.max(0,Math.min(Number(state.currentIndex||0),Math.max(deck.length-1,0)));
  copyViewerVotes(state.viewerVotes); copyGameResults(state.gameResults); gameFinished=state.gameFinished===true;
  sharedRevision=Math.max(sharedRevision,Number(state.revision||0));
  if(gameFinished){ showSummary(false); return true; }
  if(summaryScreen)summaryScreen.classList.remove("visible"); if(gameScreen)gameScreen.classList.remove("hidden");
  if(previousIndex!==currentIndex || previousSeed!==deckSeed || previouslyFinished){ isAnimating=false; if(card){ card.classList.remove("swipe-smash","swipe-pass"); card.style.opacity="1"; card.style.transition=""; } renderCurrentCard(); } else updateVotes();
  const action=state.action;
  if(fromRemote && action && action.id && action.id!==lastSeenActionId){ lastSeenActionId=action.id; if(action.type==="decision" && Number(action.cardIndex)===currentIndex){ const actionSeed=deckSeed; showCurrentResult(action.choice); setTimeout(function(){ if(deckSeed===actionSeed && currentIndex===Number(action.cardIndex))swipeCard(action.choice); },900); } }
  return true;
}
async function initializeSharedState(){ if(typeof SE_API==="undefined" || !SE_API.store){ startFreshGame(false);return; } try{ const saved=await SE_API.store.get(STORE_KEY); const valid=applySharedState(saved,false); if(valid){ setDebugStatus("☁ Synchronisé"); return; } startFreshGame(true); }catch(error){ debug("❌ Lecture du store impossible"); startFreshGame(false); } }
function registerViewerVote(userId,username,choice){ if(isAnimating||gameFinished)return; if(choice!=="smash"&&choice!=="pass")return; const voterKey=userId||username.toLowerCase(); if(!voterKey)return; const previousVote=viewerVotes[voterKey]; if(previousVote===choice)return; viewerVotes[voterKey]=choice; updateVotes(); scheduleVoteSave(); }
function saveCardResult(streamerChoice){ const character=deck[currentIndex]; if(!character)return; const alreadySaved=gameResults.some(function(entry){return entry.deckIndex===currentIndex;}); if(alreadySaved)return; const voteData=getVoteData(); gameResults.push({ deckIndex:currentIndex, name:character.name, origin:character.origin, credit:character.credit, streamerChoice, chatChoice:voteData.chatChoice, smashPercentage:voteData.smashPercentage, passPercentage:voteData.passPercentage, totalVotes:voteData.total }); }
function showCurrentResult(streamerChoice){ const voteData=getVoteData(); const streamerLine=document.querySelector(".result-streamer"); const chatLine=document.querySelector(".result-chat"); if(resultStreamer)resultStreamer.textContent=streamerChoice==="smash"?"♥ SMASH":"✕ PASS"; if(streamerLine){ streamerLine.classList.remove("smash","pass"); streamerLine.classList.add(streamerChoice); } if(resultChat){ if(voteData.chatChoice==="none")resultChat.textContent="AUCUN VOTE"; else if(voteData.chatChoice==="tie")resultChat.textContent="50 / 50"; else if(voteData.chatChoice==="smash")resultChat.textContent="♥ "+voteData.smashPercentage+"% SMASH"; else resultChat.textContent="✕ "+voteData.passPercentage+"% PASS"; } if(chatLine){ chatLine.classList.remove("smash","pass"); if(voteData.chatChoice==="smash"||voteData.chatChoice==="pass")chatLine.classList.add(voteData.chatChoice); } if(result)result.classList.add("visible"); }
function streamerVote(choice,customActionId){
  if(isAnimating||gameFinished||deck.length===0)return;
  if(choice!=="smash"&&choice!=="pass")return;
  isAnimating=true;
  const decisionIndex=currentIndex;
  const decisionSeed=deckSeed;
  saveCardResult(choice);
  showCurrentResult(choice);
  const action={ id:customActionId||(String(Date.now())+"_"+String(Math.random())), type:"decision", cardIndex:decisionIndex, choice };
  lastSeenActionId=action.id;
  saveSharedState(action);
  setTimeout(function(){ if(deckSeed===decisionSeed && currentIndex===decisionIndex)swipeCard(choice); },900);
  setTimeout(function(){
    if(deckSeed!==decisionSeed)return;
    if(currentIndex!==decisionIndex){ isAnimating=false;return; }
    const lastCard=currentIndex>=deck.length-1;
    if(lastCard)showSummary(true); else nextCard(true);
  },1650);
}
function swipeCard(choice){ if(!card)return; card.classList.remove("swipe-smash","swipe-pass"); card.classList.add(choice==="smash"?"swipe-smash":"swipe-pass"); }
function nextCard(shouldSave){ if(deck.length===0)return; if(currentIndex>=deck.length-1){ showSummary(shouldSave!==false);return; } currentIndex+=1; clearViewerVotes(); smashVotes=0;passVotes=0; hideResult(); if(card){ card.style.transition="none"; card.style.opacity="0"; card.classList.remove("swipe-smash","swipe-pass"); } renderCurrentCard(); if(card){ void card.offsetWidth; requestAnimationFrame(function(){ card.style.transition=""; card.style.opacity="1"; }); } isAnimating=false; if(shouldSave!==false) saveSharedState(makeAction("next",{cardIndex:currentIndex})); }
function showSummary(shouldSave){ gameFinished=true;isAnimating=false; if(gameScreen)gameScreen.classList.add("hidden"); if(summaryScreen)summaryScreen.classList.add("visible"); let streamerSmashes=0,streamerPasses=0,chatSmashes=0,chatPasses=0,chatTies=0,chatNoVotes=0; let strongestSmash=null,strongestPass=null; gameResults.forEach(function(entry){ if(entry.streamerChoice==="smash")streamerSmashes+=1; else streamerPasses+=1; if(entry.chatChoice==="smash")chatSmashes+=1; if(entry.chatChoice==="pass")chatPasses+=1; if(entry.chatChoice==="tie")chatTies+=1; if(entry.chatChoice==="none")chatNoVotes+=1; if(entry.totalVotes>0){ if(!strongestSmash||entry.smashPercentage>strongestSmash.smashPercentage)strongestSmash=entry; if(!strongestPass||entry.passPercentage>strongestPass.passPercentage)strongestPass=entry; } }); if(streamerSmashCount)streamerSmashCount.textContent=String(streamerSmashes); if(streamerPassCount)streamerPassCount.textContent=String(streamerPasses); if(chatSmashCount)chatSmashCount.textContent=String(chatSmashes); if(chatPassCount)chatPassCount.textContent=String(chatPasses); if(chatTieCount)chatTieCount.textContent=String(chatTies); if(chatNoVoteCount)chatNoVoteCount.textContent=String(chatNoVotes); if(topSmash)topSmash.textContent=strongestSmash?"♥ Plus gros Smash : "+strongestSmash.name+" — "+strongestSmash.smashPercentage+"%":"♥ Plus gros Smash : —"; if(topPass)topPass.textContent=strongestPass?"✕ Plus gros Pass : "+strongestPass.name+" — "+strongestPass.passPercentage+"%":"✕ Plus gros Pass : —"; if(shouldSave!==false)saveSharedState(makeAction("finish")); }
function startFreshGame(shouldSave){ gameResults.length=0; clearViewerVotes(); smashVotes=0;passVotes=0; gameFinished=false;isAnimating=false;currentIndex=0;deckSeed=1; buildDeck(); if(summaryScreen)summaryScreen.classList.remove("visible"); if(gameScreen)gameScreen.classList.remove("hidden"); if(card){ card.classList.remove("swipe-smash","swipe-pass"); card.style.opacity="1"; card.style.transition=""; } renderCurrentCard(); if(shouldSave)saveSharedState(makeAction("init")); }
function resetDeck(){ gameResults.length=0; clearViewerVotes(); smashVotes=0;passVotes=0; gameFinished=false;isAnimating=false;currentIndex=0; deckSeed+=1; buildDeck(); if(summaryScreen)summaryScreen.classList.remove("visible"); if(gameScreen)gameScreen.classList.remove("hidden"); if(card){ card.classList.remove("swipe-smash","swipe-pass"); card.style.opacity="1"; card.style.transition=""; } renderCurrentCard(); saveSharedState(makeAction("reset",{seed:deckSeed})); }
function isBroadcaster(data){ if(!data)return false; if(Array.isArray(data["badges"])){ const found=data["badges"].some(function(badge){ return badge && badge["type"]==="broadcaster"; }); if(found)return true; } const tags=data["tags"]; if(tags && typeof tags["badges"]==="string") return tags["badges"].includes("broadcaster/"); return false; }
function handleChatMessage(event){ if(!event||!event["data"])return; const data=event["data"]; const text=String(data["text"]||"").trim().toLowerCase(); const username=String(data["displayName"]||data["nick"]||"Viewer"); const userId=String(data["userId"]||(data["tags"]&&data["tags"]["user-id"])||""); const messageId=String(data["msgId"]||data["id"]||(data["tags"]&&data["tags"]["id"])||""); if(isBroadcaster(data)){ if(text==="!smash"){ streamerVote("smash",messageId?"chat_"+messageId:undefined);return; } if(text==="!pass"){ streamerVote("pass",messageId?"chat_"+messageId:undefined);return; } } if(text==="smash"){ registerViewerVote(userId,username,"smash");return; } if(text==="pass") registerViewerVote(userId,username,"pass"); }
function simulateViewerMessage(userId,username,text){ handleChatMessage({ data:{ text, displayName:username, nick:username.toLowerCase(), userId, badges:[] } }); }
function handleButton(field,value){ if(!field)return; if(isDuplicateButton(field))return; switch(field){ case "testViewer1Smash":simulateViewerMessage("test-viewer-1","ViewerTest1","smash");break; case "testViewer1Pass":simulateViewerMessage("test-viewer-1","ViewerTest1","pass");break; case "testViewer2Smash":simulateViewerMessage("test-viewer-2","ViewerTest2","smash");break; case "testViewer2Pass":simulateViewerMessage("test-viewer-2","ViewerTest2","pass");break; case "testViewer3Smash":simulateViewerMessage("test-viewer-3","ViewerTest3","smash");break; case "testViewer3Pass":simulateViewerMessage("test-viewer-3","ViewerTest3","pass");break; case "streamerSmash":streamerVote("smash");break; case "streamerPass":streamerVote("pass");break; case "nextCard": if(!isAnimating&&!gameFinished)nextCard(true); break; case "resetDeck":resetDeck();break; } }

// Le script externe reste dans le contexte du Custom Widget : SE_API est celui
// de StreamElements, sans iframe, jeton d'overlay ou API privée supplémentaire.
const CARDS_URL = "https://gawiene.github.io/smash-or-pass-peachies/data/cardsData.json";
const CACHE_KEY = "peachies-cards:" + CARDS_URL;
const loadStatus = document.getElementById("sopLoadStatus");
let widgetReady = false;
let lastLoad = null;
let initialization = Promise.resolve();
const pendingEvents = [];

function showLoadStatus(message, retry) {
  loadStatus.replaceChildren();
  loadStatus.hidden = !message;
  if (!message) return;
  const label = document.createElement("span");
  label.textContent = message;
  loadStatus.appendChild(label);
  if (retry) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Réessayer";
    button.addEventListener("click", function () { receive("onWidgetLoad", lastLoad); });
    loadStatus.appendChild(button);
  }
}

function applyColors(fieldData) {
  Object.keys(colorFields).forEach(function (field) {
    const value = String(fieldData[field] || "").trim();
    if (value && typeof CSS !== "undefined" && CSS.supports("color", value)) {
      widgetRoot.style.setProperty(colorFields[field], value);
    } else {
      widgetRoot.style.removeProperty(colorFields[field]);
    }
  });
}

function usableCards(value) {
  const cards = parseCardsData(value);
  if (!cards.length) throw new Error("Le deck est vide ou invalide.");
  cards.forEach(function (entry) {
    const url = new URL(entry.image);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Une image utilise une URL non HTTP(S).");
    }
  });
  return cards;
}

async function loadHostedCards() {
  const controller = new AbortController();
  const timeout = setTimeout(function () { controller.abort(); }, 10000);
  try {
    const response = await fetch(CARDS_URL, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: controller.signal });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const cards = usableCards(await response.json());
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cards)); } catch (error) { /* Cache facultatif dans le sandbox. */ }
    return { cards: cards, cached: false };
  } catch (error) {
    debug("❌ Chargement du deck : " + String(error.message || error));
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) return { cards: usableCards(JSON.parse(cached)), cached: true };
    } catch (cacheError) { /* Ne pas inventer de carte si le cache est indisponible. */ }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function initializeWidget(obj) {
  widgetReady = false;
  const fieldData = (obj && obj.detail && obj.detail.fieldData) || {};
  applyColors(fieldData);
  if (debugPanel) debugPanel.classList.toggle("hidden", String(fieldData.showDebug).toLowerCase() !== "true");
  deckOrder = String(fieldData.deckOrder || "normal");
  showLoadStatus("Chargement du deck…", false);
  const loaded = await loadHostedCards();
  buildConfiguredCharacters(loaded.cards);
  buildDeck();
  await initializeSharedState();
  // Une session restaurée sur la même carte doit aussi remplir le HTML injecté.
  if (!gameFinished) {
    gameScreen.classList.remove("hidden");
    renderCurrentCard({ hideResult: false });
  }
  widgetReady = true;
  showLoadStatus(loaded.cached ? "Connexion au deck indisponible : dernière version mémorisée utilisée." : "", false);
  while (pendingEvents.length && widgetReady) handleStreamElementsEvent(pendingEvents.shift());
}

function handleStreamElementsEvent(obj) {
  if (!obj.detail) return;
  const listener = String(obj.detail.listener || "");
  const event = obj.detail.event;
  if (!event) return;
  if (listener === "kvstore:update") {
    const storeData = event.data;
    if (!storeData) return;
    const key = String(storeData.key || "");
    if (!key.endsWith("." + STORE_KEY) && key !== STORE_KEY) return;
    const action = storeData.value && storeData.value.action;
    if (action && ownActionIds.has(action.id)) return;
    applySharedState(storeData.value, true);
  } else if (listener === "message") {
    handleChatMessage(event);
  } else if (listener === "event:test" || listener === "widget-button") {
    handleButton(String(event.field || ""), String(event.value || ""));
  }
}

function receive(type, obj) {
  if (type === "onWidgetLoad") {
    lastLoad = obj;
    widgetReady = false;
    initialization = initialization.then(function () { return initializeWidget(obj); }).catch(function (error) {
      widgetReady = false;
      gameScreen.classList.add("hidden");
      summaryScreen.classList.remove("visible");
      setDebugStatus("❌ Deck indisponible");
      debug("❌ Initialisation : " + String(error.message || error));
      showLoadStatus("Deck indisponible. Vérifier data/cardsData.json sur GitHub Pages puis réessayer.", true);
    });
  } else if (!widgetReady) {
    if (pendingEvents.length >= 500) pendingEvents.shift();
    pendingEvents.push(obj);
  } else {
    handleStreamElementsEvent(obj);
  }
}

const bridge = window.__sopPeachiesBridge;
if (bridge) {
  bridge.receive = receive;
  bridge.queue.splice(0).forEach(function (entry) { receive(entry[0], entry[1]); });
} else {
  // Utile pour un chargement direct du script et pour les tests locaux.
  ["onWidgetLoad", "onEventReceived"].forEach(function (type) {
    window.addEventListener(type, function (event) { receive(type, { detail: event.detail }); });
  });
}
setDebugStatus("🟢 JS exécuté");
})();

