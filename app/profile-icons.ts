export const profileIcons = [
  { key: "torch", symbol: "🔥", label: "Torch" },
  { key: "compass", symbol: "🧭", label: "Compass" },
  { key: "palm", symbol: "🌴", label: "Palm" },
  { key: "shark", symbol: "🦈", label: "Shark" },
  { key: "idol", symbol: "🗿", label: "Island idol" },
  { key: "snake", symbol: "🐍", label: "Snake" },
  { key: "wave", symbol: "🌊", label: "Wave" },
  { key: "island", symbol: "🏝️", label: "Island" },
] as const;

export type ProfileIconKey = (typeof profileIcons)[number]["key"];

export function isProfileIconKey(value: unknown): value is ProfileIconKey {
  return typeof value === "string" && profileIcons.some((icon) => icon.key === value);
}

export function profileIcon(value: unknown) {
  return profileIcons.find((icon) => icon.key === value) ?? profileIcons[0];
}
