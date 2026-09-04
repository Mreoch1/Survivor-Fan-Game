export type ScoreInput={favoriteId:string;immunityPick:string;bootPick:string;bonusPick:string;doubleDown:string;voted:Set<string>;departed:Set<string>;immunityWinners:string[];bonusAnswer:string;immunityVoid:boolean;favoriteShare:number};
export function scorePick(input:ScoreInput){const favorite=input.favoriteId&&!input.voted.has(input.favoriteId)?1:0,immunity=!input.immunityVoid&&input.immunityWinners.includes(input.immunityPick)?2:0,boot=input.bootPick&&input.voted.has(input.bootPick)?3:0,bonus=input.bonusPick===input.bonusAnswer?1:0,underdog=favorite&&!input.departed.has(input.favoriteId)&&input.favoriteShare<.2?1:0,doublePoint=input.doubleDown==="immunity"?immunity:input.doubleDown==="boot"?boot:input.doubleDown==="bonus"?bonus:0;return{favorite,immunity,boot,bonus,underdog,doublePoint,total:favorite+immunity+boot+bonus+underdog+doublePoint}}
export function applyImmunityStreak(current:number,immunityPoint:number,immunityVoid:boolean){if(immunityVoid)return{streak:current,bonus:0};const streak=immunityPoint>0?current+1:0;return{streak,bonus:streak>0&&streak%3===0?2:0}}

export type SeasonPickScoreInput={
 individualGamePick:string;
 endgamePick:string;
 endgamePickSwitched:boolean;
 departedBeforeIndividual:Set<string>;
 individualGameStarted:boolean;
 finaleWinner:string;
 finalists:string[];
};

export function scoreSeasonPick(input:SeasonPickScoreInput){
 const reachedIndividualGame=Boolean(input.individualGameStarted&&input.individualGamePick&&!input.departedBeforeIndividual.has(input.individualGamePick));
 const individualGamePoints=reachedIndividualGame?10:0;
 const endgameMultiplier=input.endgamePickSwitched?0.5:1;
 const endgamePoints=!input.finaleWinner||!input.endgamePick?0:input.endgamePick===input.finaleWinner?10*endgameMultiplier:input.finalists.includes(input.endgamePick)?3*endgameMultiplier:0;
 return{reachedIndividualGame,individualGamePoints,endgamePoints,total:individualGamePoints+endgamePoints};
}
