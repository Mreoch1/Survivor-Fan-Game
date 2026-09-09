export function playerLabel(teamName: string, displayName: string) {
  const team = teamName.trim();
  const player = displayName.trim();
  return team && player && team !== player ? `${team} (${player})` : team || player;
}
