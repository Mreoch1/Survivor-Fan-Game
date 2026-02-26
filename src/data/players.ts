/**
 * Survivor Season 50 cast (2026). Tribes: Cila (orange), Kalo (teal), Vatu (magenta).
 * Fan-voted official colors (option B). Accomplishments from EW and official sources.
 * Add imageUrl (self-hosted or licensed) per player for face card photos.
 */

/** Official Survivor 50 Challenge castaways page. */
export const CASTAWAYS_PAGE_URL = "https://www.survivor50challenge.com/castaways";

export type TribeId = "cila" | "kalo" | "vatu";

export interface Player {
  id: string;
  name: string;
  shortName?: string;
  tribeId: TribeId;
  /** Order on official cast list / for display */
  order: number;
  /** Previous seasons and placement, e.g. "Survivor: Borneo (8th)" */
  previousSeasons: string[];
  /** One-line bio or accomplishment */
  accomplishment: string;
  /** Stats: times played, best finish, etc. */
  stats: {
    timesPlayed: number;
    bestFinish: number;
    isWinner: boolean;
  };
  /** Optional image URL; use placeholder or self-hosted */
  imageUrl: string | null;
}

export const TRIBES: Record<TribeId, { name: string; color: string }> = {
  cila: { name: "Cila", color: "#e85d04" },
  kalo: { name: "Kalo", color: "#0d9488" },
  vatu: { name: "Vatu", color: "#c026d3" },
};

export const PLAYERS: Player[] = [
  {
    id: "jenna-lewis-dougherty",
    name: "Jenna Lewis-Dougherty",
    tribeId: "cila",
    order: 1,
    previousSeasons: ["Survivor: Borneo (8th)", "Survivor: All-Stars (3rd)"],
    accomplishment: "Original castaway; two-time final tribal council contender.",
    stats: { timesPlayed: 2, bestFinish: 3, isWinner: false },
    imageUrl: "/Jenna Lewis-Dougherty.png",
  },
  {
    id: "colby-donaldson",
    name: "Colby Donaldson",
    tribeId: "kalo",
    order: 2,
    previousSeasons: [
      "Survivor: The Australian Outback (2nd)",
      "Survivor: All-Stars (12th)",
      "Survivor: Heroes vs. Villains (5th)",
    ],
    accomplishment: "Legendary challenge dominator; runner-up in Australia.",
    stats: { timesPlayed: 3, bestFinish: 2, isWinner: false },
    imageUrl: "/Colby Donaldson.png",
  },
  {
    id: "stephenie-lagrossa-kendrick",
    name: "Stephenie LaGrossa Kendrick",
    tribeId: "vatu",
    order: 3,
    previousSeasons: [
      "Survivor: Palau (7th)",
      "Survivor: Guatemala (2nd)",
      "Survivor: Heroes vs. Villains (19th)",
    ],
    accomplishment: "Sole survivor of Ulong; Guatemala runner-up.",
    stats: { timesPlayed: 3, bestFinish: 2, isWinner: false },
    imageUrl: "/Stephenie LaGrossa Kendrick.png",
  },
  {
    id: "cirie-fields",
    name: "Cirie Fields",
    tribeId: "cila",
    order: 4,
    previousSeasons: [
      "Survivor: Panama (4th)",
      "Survivor: Micronesia (3rd)",
      "Survivor: Heroes vs. Villains (17th)",
      "Survivor: Game Changers (6th)",
    ],
    accomplishment: "Four-time player; strategic legend, never voted out by majority.",
    stats: { timesPlayed: 4, bestFinish: 3, isWinner: false },
    imageUrl: "/Cirie Fields.png",
  },
  {
    id: "ozzy-lusth",
    name: "Ozzy Lusth",
    tribeId: "cila",
    order: 5,
    previousSeasons: [
      "Survivor: Cook Islands (2nd)",
      "Survivor: Micronesia (9th)",
      "Survivor: South Pacific (4th)",
      "Survivor: Game Changers (12th)",
    ],
    accomplishment: "Challenge beast; Cook Islands runner-up. Fifth time playing.",
    stats: { timesPlayed: 4, bestFinish: 2, isWinner: false },
    imageUrl: "/Ozzy Lusth.png",
  },
  {
    id: "benjamin-coach-wade",
    name: "Benjamin \"Coach\" Wade",
    tribeId: "kalo",
    order: 6,
    previousSeasons: [
      "Survivor: Tocantins (5th)",
      "Survivor: Heroes vs. Villains (12th)",
      "Survivor: South Pacific (2nd)",
    ],
    accomplishment: "South Pacific runner-up; iconic character.",
    stats: { timesPlayed: 3, bestFinish: 2, isWinner: false },
    imageUrl: "/Benjamin %22Coach%22 Wade.png",
  },
  {
    id: "aubry-bracco",
    name: "Aubry Bracco",
    tribeId: "vatu",
    order: 7,
    previousSeasons: [
      "Survivor: Kaoh Rong (2nd)",
      "Survivor: Game Changers (5th)",
      "Survivor: Edge of Extinction (16th)",
    ],
    accomplishment: "Kaoh Rong runner-up; strategic and emotional player.",
    stats: { timesPlayed: 3, bestFinish: 2, isWinner: false },
    imageUrl: "/Aubry Bracco.png",
  },
  {
    id: "chrissy-hofbeck",
    name: "Chrissy Hofbeck",
    tribeId: "cila",
    order: 8,
    previousSeasons: ["Survivor: Heroes vs. Healers vs. Hustlers (2nd)"],
    accomplishment: "HHH runner-up; dominant end-game strategist.",
    stats: { timesPlayed: 1, bestFinish: 2, isWinner: false },
    imageUrl: "/Chrissy Hofbeck.png",
  },
  {
    id: "christian-hubicki",
    name: "Christian Hubicki",
    tribeId: "cila",
    order: 9,
    previousSeasons: ["Survivor: David vs. Goliath (7th)"],
    accomplishment: "DvG fan favorite; strategic underdog.",
    stats: { timesPlayed: 1, bestFinish: 7, isWinner: false },
    imageUrl: "/Christian Hubicki.png",
  },
  {
    id: "angelina-keeley",
    name: "Angelina Keeley",
    tribeId: "kalo",
    order: 10,
    previousSeasons: ["Survivor: David vs. Goliath (3rd)"],
    accomplishment: "DvG finalist; memorable negotiator.",
    stats: { timesPlayed: 1, bestFinish: 3, isWinner: false },
    imageUrl: "/Angelina Keeley .png",
  },
  {
    id: "mike-white",
    name: "Mike White",
    tribeId: "cila",
    order: 11,
    previousSeasons: ["Survivor: David vs. Goliath (2nd)"],
    accomplishment: "DvG runner-up; The White Lotus creator.",
    stats: { timesPlayed: 1, bestFinish: 2, isWinner: false },
    imageUrl: "/Mike White.png",
  },
  {
    id: "rick-devens",
    name: "Rick Devens",
    tribeId: "cila",
    order: 12,
    previousSeasons: ["Survivor: Edge of Extinction (4th)"],
    accomplishment: "EoE fourth place; comeback from Edge.",
    stats: { timesPlayed: 1, bestFinish: 4, isWinner: false },
    imageUrl: "/Rick Devens.png",
  },
  {
    id: "jonathan-young",
    name: "Jonathan Young",
    tribeId: "kalo",
    order: 13,
    previousSeasons: ["Survivor 42 (4th)"],
    accomplishment: "Survivor 42 fourth place; physical powerhouse.",
    stats: { timesPlayed: 1, bestFinish: 4, isWinner: false },
    imageUrl: "/Jonathan Young.png",
  },
  {
    id: "emily-flippen",
    name: "Emily Flippen",
    tribeId: "cila",
    order: 14,
    previousSeasons: ["Survivor 45 (7th)"],
    accomplishment: "Survivor 45 seventh place; sharp strategist.",
    stats: { timesPlayed: 1, bestFinish: 7, isWinner: false },
    imageUrl: "/Emily Flippen.png",
  },
  {
    id: "dee-valladares",
    name: "Dee Valladares",
    tribeId: "vatu",
    order: 15,
    previousSeasons: ["Survivor 45 (Winner)"],
    accomplishment: "Survivor 45 winner.",
    stats: { timesPlayed: 1, bestFinish: 1, isWinner: true },
    imageUrl: "/Dee Valladares.png",
  },
  {
    id: "quintavius-q-burdette",
    name: "Quintavius \"Q\" Burdette",
    shortName: "Q Burdette",
    tribeId: "vatu",
    order: 16,
    previousSeasons: ["Survivor 46 (6th)"],
    accomplishment: "Survivor 46 sixth place.",
    stats: { timesPlayed: 1, bestFinish: 6, isWinner: false },
    imageUrl: "/Quintavius %22Q%22 Burdette.png",
  },
  {
    id: "charlie-davis",
    name: "Charlie Davis",
    tribeId: "kalo",
    order: 17,
    previousSeasons: ["Survivor 46 (2nd)"],
    accomplishment: "Survivor 46 runner-up.",
    stats: { timesPlayed: 1, bestFinish: 2, isWinner: false },
    imageUrl: "/Charlie Davis.png",
  },
  {
    id: "tiffany-ervin",
    name: "Tiffany Ervin",
    tribeId: "vatu",
    order: 18,
    previousSeasons: ["Survivor 46 (8th)"],
    accomplishment: "Survivor 46 eighth place.",
    stats: { timesPlayed: 1, bestFinish: 8, isWinner: false },
    imageUrl: "/Tiffany Nicole Ervin.png",
  },
  {
    id: "genevieve-mushaluk",
    name: "Genevieve Mushaluk",
    tribeId: "kalo",
    order: 19,
    previousSeasons: ["Survivor 47 (5th)"],
    accomplishment: "Survivor 47 fifth place.",
    stats: { timesPlayed: 1, bestFinish: 5, isWinner: false },
    imageUrl: "/Genevieve Mushaluk.png",
  },
  {
    id: "kyle-fraser",
    name: "Kyle Fraser",
    tribeId: "vatu",
    order: 20,
    previousSeasons: ["Survivor 48 (Winner)"],
    accomplishment: "Survivor 48 winner.",
    stats: { timesPlayed: 1, bestFinish: 1, isWinner: true },
    imageUrl: "/Kyle Fraser.png",
  },
  {
    id: "joe-hunter",
    name: "Joe Hunter",
    tribeId: "cila",
    order: 21,
    previousSeasons: ["Survivor 48 (3rd)"],
    accomplishment: "Survivor 48 third place.",
    stats: { timesPlayed: 1, bestFinish: 3, isWinner: false },
    imageUrl: "/Joe Hunter.png",
  },
  {
    id: "kamilla-karthigesu",
    name: "Kamilla Karthigesu",
    tribeId: "kalo",
    order: 22,
    previousSeasons: ["Survivor 48 (4th)"],
    accomplishment: "Survivor 48 fourth place.",
    stats: { timesPlayed: 1, bestFinish: 4, isWinner: false },
    imageUrl: "/Kamilla Karthigesu.png",
  },
  {
    id: "savannah-louie",
    name: "Savannah Louie",
    tribeId: "cila",
    order: 23,
    previousSeasons: ["Survivor 49 (Winner)"],
    accomplishment: "Survivor 49 winner; back-to-back with 50.",
    stats: { timesPlayed: 1, bestFinish: 1, isWinner: true },
    imageUrl: "/Savannah Louie.png",
  },
  {
    id: "rizo-velovic",
    name: "Rizo Velovic",
    tribeId: "vatu",
    order: 24,
    previousSeasons: ["Survivor 49 (4th)"],
    accomplishment: "Survivor 49 fourth place; back-to-back seasons.",
    stats: { timesPlayed: 1, bestFinish: 4, isWinner: false },
    imageUrl: "/Rizo Velovic.png",
  },
];

/** DiceBear Initials avatar URL (CC0) when no imageUrl. Seed by player id for consistency. */
export function getPlayerAvatarUrl(player: { id: string; imageUrl: string | null }): string {
  if (player.imageUrl) return player.imageUrl;
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(player.id)}`;
}

/** First letter of first name + first letter of last name for placeholder avatars. */
export function getPlayerInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    const first = parts[0];
    const last = parts[parts.length - 1].replace(/^["']|["']$/g, "");
    return (first[0] + (last[0] ?? "")).toUpperCase();
  }
  return (name[0] ?? "?").toUpperCase();
}

export function getPlayerById(id: string): Player | undefined {
  return PLAYERS.find((p) => p.id === id);
}

export function getPlayersByTribe(tribeId: TribeId): Player[] {
  return PLAYERS.filter((p) => p.tribeId === tribeId).sort(
    (a, b) => a.order - b.order
  );
}
