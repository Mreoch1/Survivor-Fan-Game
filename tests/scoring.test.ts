import assert from "node:assert/strict";
import test from "node:test";
import { applyImmunityStreak, scorePick, scoreSeasonPick } from "../lib/scoring";

test("six-player season simulation exercises every scoring path",()=>{const totals=[0,0,0,0,0,0],boots=["a","b","c","d"],immunity=["Savu","Toka","x","y"];for(let week=0;week<4;week++){const voted=new Set([boots[week]]),departed=new Set(voted);for(let player=0;player<6;player++){const result=scorePick({favoriteId:player===week?boots[week]:"safe",immunityPick:player<3?immunity[week]:"wrong",bootPick:player%2===0?boots[week]:"wrong",bonusPick:player<4?"Yes":"No",doubleDown:week===1&&player===1?"immunity":"",voted,departed,immunityWinners:[immunity[week]],bonusAnswer:"Yes",immunityVoid:false,favoriteShare:player===5?.1:.5});totals[player]+=result.total}}assert.deepEqual(totals,[27,17,27,7,12,4]);assert.ok(new Set(totals).size>1)})
test("medical departures preserve the favorite survival point and void immunity scores zero",()=>{const score=scorePick({favoriteId:"injured",immunityPick:"Savu",bootPick:"injured",bonusPick:"No",doubleDown:"immunity",voted:new Set(),departed:new Set(["injured"]),immunityWinners:[],bonusAnswer:"No",immunityVoid:true,favoriteShare:.1});assert.deepEqual(score,{favorite:1,immunity:0,boot:0,bonus:1,underdog:0,doublePoint:0,total:2})})
test("a void immunity episode neither awards points nor breaks a streak",()=>{let state=applyImmunityStreak(0,2,false);state=applyImmunityStreak(state.streak,2,false);state=applyImmunityStreak(state.streak,0,true);assert.deepEqual(state,{streak:2,bonus:0});state=applyImmunityStreak(state.streak,2,false);assert.deepEqual(state,{streak:3,bonus:2})})

test("an original pick that reaches the individual game keeps full endgame points",()=>{const result=scoreSeasonPick({individualGamePick:"a",endgamePick:"a",endgamePickSwitched:false,departedBeforeIndividual:new Set(),individualGameStarted:true,finaleWinner:"a",finalists:["b","c"]});assert.deepEqual(result,{reachedIndividualGame:true,individualGamePoints:10,endgamePoints:10,total:20})})

test("a switched Final Torch pick earns half of winner or finalist points",()=>{const winner=scoreSeasonPick({individualGamePick:"a",endgamePick:"b",endgamePickSwitched:true,departedBeforeIndividual:new Set(),individualGameStarted:true,finaleWinner:"b",finalists:["c","d"]}),finalist=scoreSeasonPick({individualGamePick:"a",endgamePick:"c",endgamePickSwitched:true,departedBeforeIndividual:new Set(),individualGameStarted:true,finaleWinner:"b",finalists:["c","d"]});assert.equal(winner.total,15);assert.equal(winner.endgamePoints,5);assert.equal(finalist.total,11.5);assert.equal(finalist.endgamePoints,1.5)})

test("a pick eliminated before the individual game earns zero but may switch",()=>{const result=scoreSeasonPick({individualGamePick:"a",endgamePick:"b",endgamePickSwitched:true,departedBeforeIndividual:new Set(["a"]),individualGameStarted:true,finaleWinner:"b",finalists:["c","d"]});assert.deepEqual(result,{reachedIndividualGame:false,individualGamePoints:0,endgamePoints:5,total:5})})

test("the castaway eliminated in the announcement episode still earns ten points",()=>{const result=scoreSeasonPick({individualGamePick:"a",endgamePick:"b",endgamePickSwitched:true,departedBeforeIndividual:new Set(),individualGameStarted:true,finaleWinner:"",finalists:[]});assert.deepEqual(result,{reachedIndividualGame:true,individualGamePoints:10,endgamePoints:0,total:10})})

test("Play Your Advantage is +1 correct, -1 wrong, and 0 when skipped", () => {
 const base = { favoriteId: "out", immunityPick: "wrong", bootPick: "wrong", bonusPick: "", doubleDown: "", voted: new Set(["out"]), departed: new Set(["out"]), immunityWinners: ["Savu"], bonusAnswer: "Yes", immunityVoid: false, favoriteShare: 1 };
 for (const [answer, expected] of [["Yes", 1], ["No", -1], ["", 0]] as const) {
  const score = scorePick({ ...base, bonusPick: answer });
  assert.equal(score.bonus, expected);
  assert.equal(score.total, expected);
 }
 assert.equal(scorePick({ ...base, bonusAnswer: "" }).bonus, 0, "No answer and no result cannot earn a point");
 assert.equal(scorePick({ ...base, bonusPick: "No", bonusAnswer: "" }).bonus, 0, "An unresolved question cannot penalize a pick");
 const wrongWithShot = scorePick({ ...base, bonusPick: "No", doubleDown: "bonus" });
 assert.equal(wrongWithShot.doublePoint, 0);
 assert.equal(wrongWithShot.total, -1, "Shot in the Dark repeats rewards only");
 const rightWithShot = scorePick({ ...base, bonusPick: "Yes", doubleDown: "bonus" });
 assert.equal(rightWithShot.total, 2);
 assert.equal(scorePick({ ...base, doubleDown: "bonus" }).total, 0);
});
